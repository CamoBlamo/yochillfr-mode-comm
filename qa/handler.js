const {
    MessageFlags,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
    PermissionFlagsBits,
} = require('discord.js')
const config = require('./config')
const store = require('./store')

const PAGE_SIZE = 5 // Discord allows 5 inputs per modal
const sessions = new Map() // userId -> { answers, page, expires }
const handling = new Set() // submission message IDs being approved/denied

const pages = []
for (let i = 0; i < config.questions.length; i += PAGE_SIZE) {
    pages.push(config.questions.slice(i, i + PAGE_SIZE))
}

// Keep the whole submission under Discord's 4000-char limit for one message
const questionChars = config.questions.reduce((n, q) => n + (q.question || q.label || '').length + 12, 0)
const ANSWER_MAX = Math.max(
    50,
    Math.min(config.MAX_ANSWER_LENGTH, Math.floor((3300 - questionChars) / Math.max(1, config.questions.length)))
)

const text = (content) => new TextDisplayBuilder().setContent(content)
const separator = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
const now = () => Math.floor(Date.now() / 1000)

// Ephemeral reply, or edit the ephemeral "Continue" message if it came from one
function respond(interaction, payload) {
    if (typeof payload === 'string') payload = { content: payload, components: [] }
    if (interaction.isModalSubmit() && interaction.isFromMessage()) return interaction.update(payload)
    return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral })
}

function isReviewer(member) {
    if (config.REVIEWER_ROLE_IDS.length) return member.roles.cache.hasAny(...config.REVIEWER_ROLE_IDS)
    return member.permissions.has(PermissionFlagsBits.ManageRoles)
}

async function dmUser(client, userId, content) {
    if (!config.DM_RESULTS) return
    const user = await client.users.fetch(userId).catch(() => null)
    await user?.send(content).catch(() => {})
}

// ---------- Modal pages ----------

function buildModal(pageIndex) {
    const title = pages.length > 1
        ? `Trial Mod Q/A (${pageIndex + 1}/${pages.length})`
        : 'Trial Mod Q/A'

    const labels = pages[pageIndex].map((q, j) => {
        const i = pageIndex * PAGE_SIZE + j

        const input = new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(ANSWER_MAX)
        if (q.minLength) input.setMinLength(Math.min(q.minLength, ANSWER_MAX))

        const label = new LabelBuilder()
            .setLabel((q.label || `Question ${i + 1}`).slice(0, 45))
            .setTextInputComponent(input)
        if (q.question) label.setDescription(q.question.slice(0, 100))

        return label
    })

    return new ModalBuilder()
        .setCustomId(`qa:page:${pageIndex}`)
        .setTitle(title)
        .addLabelComponents(...labels)
}

// ---------- Start (/qa) ----------

async function startQA(interaction) {
    const eph = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral })
    const member = interaction.member
    const userId = interaction.user.id

    if (member.roles.cache.has(config.READY_SV_ROLE_ID)) return eph('You already have Ready for SV.')
    if (!member.roles.cache.has(config.TRIAL_MOD_ROLE_ID)) return eph('Only Trial Moderators can take the Q/A.')
    if (!pages.length) return eph('No questions are set up yet.')

    const data = store.load()
    if (data.pending[userId]) return eph('Your Q/A is already submitted and waiting for review.')

    const until = data.cooldowns[userId]
    if (until && until > Date.now()) {
        return eph(`You can retake the Q/A <t:${Math.floor(until / 1000)}:R>.`)
    }

    sessions.set(userId, {
        answers: [],
        page: 0,
        expires: Date.now() + config.SESSION_MINUTES * 60_000,
    })

    await interaction.showModal(buildModal(0))
}

// ---------- Page submit / continue ----------

function getSession(userId) {
    const session = sessions.get(userId)
    if (!session || session.expires < Date.now()) {
        sessions.delete(userId)
        return null
    }
    return session
}

async function handlePageSubmit(interaction, pageIndex) {
    const userId = interaction.user.id
    const session = getSession(userId)

    if (!session || session.page !== pageIndex) {
        return respond(interaction, 'Your Q/A session expired. Run `/qa` to start again.')
    }

    pages[pageIndex].forEach((_, j) => {
        const i = pageIndex * PAGE_SIZE + j
        session.answers[i] = interaction.fields.getTextInputValue(`q${i}`)
    })
    session.page++

    if (session.page < pages.length) {
        return respond(interaction, {
            content: `Page ${pageIndex + 1}/${pages.length} saved.`,
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('qa:next')
                        .setLabel(`Continue (${session.page + 1}/${pages.length})`)
                        .setStyle(ButtonStyle.Primary)
                ),
            ],
        })
    }

    sessions.delete(userId)
    await submit(interaction, session.answers)
}

async function handleNext(interaction) {
    const session = getSession(interaction.user.id)
    if (!session) {
        return interaction.update({ content: 'Your Q/A session expired. Run `/qa` to start again.', components: [] })
    }
    await interaction.showModal(buildModal(session.page))
}

// ---------- Send to admin channel ----------

function buildSubmission(user, answers) {
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            text('## Trial Mod Q/A Submission'),
            text(`**Trial Mod:** ${user} (${user.tag})\n**Submitted:** <t:${now()}:F>`)
        )
        .addSeparatorComponents(separator())

    config.questions.forEach((q, i) => {
        container.addTextDisplayComponents(
            text(`**${i + 1}. ${q.question || q.label}**\n${answers[i] || '*No answer*'}`)
        )
    })

    container
        .addSeparatorComponents(separator())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`qa:approve:${user.id}`)
                    .setLabel('Approve')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`qa:deny:${user.id}`)
                    .setLabel('Deny')
                    .setStyle(ButtonStyle.Danger)
            )
        )

    return container
}

async function submit(interaction, answers) {
    const channel = await interaction.client.channels.fetch(config.ADMIN_CHANNEL_ID)

    const msg = await channel.send({
        components: [buildSubmission(interaction.user, answers)],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    })

    const data = store.load()
    data.pending[interaction.user.id] = msg.id
    store.save(data)

    await respond(interaction, 'Your Q/A has been submitted for review. You\'ll be notified of the result.')
}

// ---------- Approve / deny ----------

// Swap the buttons for a status line and recolor the container
function resolvedComponents(message, statusText, color) {
    const json = message.components.map((c) => c.toJSON())
    const container = json.find((c) => c.type === ComponentType.Container)

    container.components = container.components.filter((c) => c.type !== ComponentType.ActionRow)
    container.components.push({ type: ComponentType.TextDisplay, content: statusText })
    container.accent_color = color

    return json
}

async function handleApprove(interaction, userId) {
    if (!isReviewer(interaction.member)) {
        return interaction.reply({ content: 'You can\'t review Q/A submissions.', flags: MessageFlags.Ephemeral })
    }

    const messageId = interaction.message.id
    if (handling.has(messageId)) {
        return interaction.reply({ content: 'This submission is already being handled.', flags: MessageFlags.Ephemeral })
    }
    handling.add(messageId)

    try {
        await interaction.deferUpdate()

        const data = store.load()
        const member = await interaction.guild.members.fetch(userId).catch(() => null)

        if (!member) {
            delete data.pending[userId]
            store.save(data)
            return interaction.editReply({
                components: resolvedComponents(
                    interaction.message,
                    `⚠️ **Not approved:** <@${userId}> is no longer in the server.\n-# Handled by ${interaction.user} <t:${now()}:R>`,
                    0xfee75c
                ),
                flags: MessageFlags.IsComponentsV2,
            })
        }

        try {
            await member.roles.add(config.READY_SV_ROLE_ID, `Q/A approved by ${interaction.user.tag}`)
        } catch (err) {
            console.error('[Q/A] Failed to add Ready for SV role:', err)
            return interaction.followUp({
                content: 'Couldn\'t give the role. Make sure the bot has **Manage Roles** and its role is above Ready for SV.',
                flags: MessageFlags.Ephemeral,
            })
        }

        delete data.pending[userId]
        delete data.cooldowns[userId]
        store.save(data)

        await interaction.editReply({
            components: resolvedComponents(
                interaction.message,
                `✅ **Approved** by ${interaction.user} <t:${now()}:R>\nGiven <@&${config.READY_SV_ROLE_ID}>.`,
                0x57f287
            ),
            flags: MessageFlags.IsComponentsV2,
        })

        await dmUser(interaction.client, userId, 'Your Trial Moderator Q/A was **approved**. You now have **Ready for SV**.')
    } finally {
        handling.delete(messageId)
    }
}

async function handleDeny(interaction, userId) {
    if (!isReviewer(interaction.member)) {
        return interaction.reply({ content: 'You can\'t review Q/A submissions.', flags: MessageFlags.Ephemeral })
    }

    const modal = new ModalBuilder()
        .setCustomId(`qa:denyreason:${userId}`)
        .setTitle('Deny Q/A')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Reason')
                .setDescription('Optional. Sent to the trial mod.')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('reason')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )

    await interaction.showModal(modal)
}

async function handleDenySubmit(interaction, userId) {
    if (!isReviewer(interaction.member)) {
        return interaction.reply({ content: 'You can\'t review Q/A submissions.', flags: MessageFlags.Ephemeral })
    }

    const messageId = interaction.message.id
    if (handling.has(messageId)) {
        return interaction.reply({ content: 'This submission is already being handled.', flags: MessageFlags.Ephemeral })
    }
    handling.add(messageId)

    try {
        await interaction.deferUpdate()

        const reason = interaction.fields.getTextInputValue('reason').trim()
        const data = store.load()

        let retake = null
        if (config.COOLDOWN_HOURS > 0) {
            retake = Date.now() + config.COOLDOWN_HOURS * 3_600_000
            data.cooldowns[userId] = retake
        }
        delete data.pending[userId]
        store.save(data)

        const retakeText = retake ? `<t:${Math.floor(retake / 1000)}:R>` : 'anytime'

        await interaction.editReply({
            components: resolvedComponents(
                interaction.message,
                `❌ **Denied** by ${interaction.user} <t:${now()}:R>\n` +
                `**Reason:** ${reason || 'None given'}\n` +
                `**Can retake:** ${retakeText}`,
                0xed4245
            ),
            flags: MessageFlags.IsComponentsV2,
        })

        await dmUser(
            interaction.client,
            userId,
            `Your Trial Moderator Q/A was **denied**.\n` +
            `**Reason:** ${reason || 'None given'}\n` +
            `You can retake it ${retakeText}.`
        )
    } finally {
        handling.delete(messageId)
    }
}

// ---------- Router ----------

async function handleQAInteraction(interaction) {
    const [, action, arg] = interaction.customId.split(':')

    if (interaction.isModalSubmit()) {
        if (action === 'page') return handlePageSubmit(interaction, Number(arg))
        if (action === 'denyreason') return handleDenySubmit(interaction, arg)
        return
    }

    if (interaction.isButton()) {
        if (action === 'next') return handleNext(interaction)
        if (action === 'approve') return handleApprove(interaction, arg)
        if (action === 'deny') return handleDeny(interaction, arg)
    }
}

module.exports = { startQA, handleQAInteraction }
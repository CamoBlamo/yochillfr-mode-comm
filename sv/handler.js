const {
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionFlagsBits,
} = require('discord.js')
const config = require('./config')
const store = require('./store')

const handling = new Set() // request message IDs being approved/denied

// ---------- Helpers ----------

const text = (content) => new TextDisplayBuilder().setContent(content)
const separator = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
const image = (url) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url))
const unix = (ms = Date.now()) => Math.floor(ms / 1000)
const quote = (s) => s.split('\n').map((l) => `> ${l}`).join('\n')
const ephemeral = (interaction, content) => interaction.reply({ content, flags: MessageFlags.Ephemeral })

function isRequester(member) {
    if (!config.REQUESTER_ROLE_IDS.length) return true
    return member.roles.cache.hasAny(...config.REQUESTER_ROLE_IDS)
}

function isReviewer(member) {
    if (config.REVIEWER_ROLE_IDS.length) return member.roles.cache.hasAny(...config.REVIEWER_ROLE_IDS)
    return member.permissions.has(PermissionFlagsBits.ManageRoles)
}

function newContainer() {
    const c = new ContainerBuilder()
    if (config.images.bannerUrl) c.addMediaGalleryComponents(image(config.images.bannerUrl))
    return c
}

function addFooter(c) {
    if (config.images.footerImageUrl) c.addMediaGalleryComponents(image(config.images.footerImageUrl))
    return c
}

// ---------- Request message ----------

// resolution: null while pending, or { decision: 'approved'|'denied', by, at, note, dmFailed }
function buildRequest(userId, request, resolution = null) {
    const t = config.text
    const b = config.bullet

    const container = newContainer()
        .addTextDisplayComponents(
            text(`## ${t.titleEmoji ? `${t.titleEmoji} ` : ''}${t.title}`),
            text(`> ${t.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Request Information\n' +
                `${b} Requester: <@${userId}>\n` +
                `${b} Requested: <t:${unix(request.requestedAt)}:F> (<t:${unix(request.requestedAt)}:R>)`
            )
        )

    if (request.answers.length) {
        const answers = request.answers
            .map((a) => `**${a.label}**\n${a.value ? quote(a.value) : '> *Not provided*'}`)
            .join('\n\n')

        container
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(text(`### Details\n${answers}`))
    }

    container.addSeparatorComponents(separator())

    if (resolution) {
        const approved = resolution.decision === 'approved'
        const lines = [
            `${approved ? '✅ **Approved**' : '❌ **Denied**'} by <@${resolution.by}> <t:${unix(resolution.at)}:R>`,
        ]
        if (resolution.note) lines.push(`**${approved ? 'Note' : 'Reason'}:** ${resolution.note}`)
        if (resolution.dmFailed) lines.push('-# Couldn\'t DM the requester (DMs closed).')
        container.addTextDisplayComponents(text(lines.join('\n')))
    } else {
        container.addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId(`sv:approve:${userId}`)
                    .setLabel('Approve')
                    .setEmoji('✅')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId(`sv:deny:${userId}`)
                    .setLabel('Deny')
                    .setEmoji('✖️')
                    .setStyle(ButtonStyle.Danger)
            )
        )

        const pings = config.PING_ROLE_IDS.map((id) => `<@&${id}>`).join(' ')
        if (pings) container.addTextDisplayComponents(text(`-# ${pings}`))
    }

    return { components: [addFooter(container)], flags: MessageFlags.IsComponentsV2 }
}

// ---------- Request form ----------

function buildForm() {
    const labels = config.questions.slice(0, 5).map((q, i) => {
        const input = new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setStyle(q.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(q.required !== false)
            .setMaxLength(q.maxLength ?? 500)
        if (q.minLength) input.setMinLength(q.minLength)
        if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100))

        const label = new LabelBuilder()
            .setLabel(q.label.slice(0, 45))
            .setTextInputComponent(input)
        if (q.description) label.setDescription(q.description.slice(0, 100))
        return label
    })

    return new ModalBuilder()
        .setCustomId('sv:form')
        .setTitle(config.text.formTitle.slice(0, 45))
        .addLabelComponents(...labels)
}

// Checks shared by the command and the form submit. Returns an error string or null.
function requestBlocked(member) {
    if (!isRequester(member)) return 'You can\'t send an SV request.'

    const data = store.load()
    const userId = member.id

    if (data.pending[userId]) return 'You already have an SV request waiting for review.'

    const until = data.cooldowns[userId]
    if (until && until > Date.now()) return `You can send another SV request <t:${unix(until)}:R>.`

    return null
}

async function startRequest(interaction) {
    const blocked = requestBlocked(interaction.member)
    if (blocked) return ephemeral(interaction, blocked)

    if (!config.questions.length) return submitRequest(interaction, [])
    await interaction.showModal(buildForm())
}

async function handleFormSubmit(interaction) {
    const answers = config.questions.slice(0, 5).map((q, i) => ({
        label: q.label,
        value: interaction.fields.getTextInputValue(`q${i}`).trim(),
    }))
    await submitRequest(interaction, answers)
}

async function submitRequest(interaction, answers) {
    // Re-check in case they submitted two forms at once
    const blocked = requestBlocked(interaction.member)
    if (blocked) return ephemeral(interaction, blocked)

    const channel = await interaction.client.channels.fetch(config.REQUEST_CHANNEL_ID).catch(() => null)
    if (!channel) {
        console.error('[SV] REQUEST_CHANNEL_ID is missing or the bot can\'t see it.')
        return ephemeral(interaction, 'SV requests aren\'t set up yet. Let staff know.')
    }

    const userId = interaction.user.id
    const request = { answers, requestedAt: Date.now() }

    // Reserve the slot before sending so a double submit can't create two requests
    const data = store.load()
    data.pending[userId] = { ...request, messageId: null }
    store.save(data)

    try {
        const message = await channel.send({
            ...buildRequest(userId, request),
            allowedMentions: { roles: config.PING_ROLE_IDS, users: [] },
        })

        const after = store.load()
        after.pending[userId] = { ...request, messageId: message.id }
        store.save(after)
    } catch (err) {
        const after = store.load()
        delete after.pending[userId]
        store.save(after)
        throw err
    }

    await ephemeral(interaction, config.text.submitted)
}

// ---------- Approve / deny ----------

function noteModal(decision, userId) {
    const approve = decision === 'approve'
    return new ModalBuilder()
        .setCustomId(`sv:${decision}form:${userId}`)
        .setTitle(approve ? 'Approve SV Request' : 'Deny SV Request')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel(approve ? 'Note' : 'Reason')
                .setDescription('Optional. Sent to the requester.')
                .setTextInputComponent(
                    new TextInputBuilder()
                        .setCustomId('note')
                        .setStyle(TextInputStyle.Paragraph)
                        .setRequired(false)
                        .setMaxLength(500)
                )
        )
}

async function handleDecisionButton(interaction, decision, userId) {
    if (!isReviewer(interaction.member)) return ephemeral(interaction, 'You can\'t review SV requests.')
    await interaction.showModal(noteModal(decision, userId))
}

async function applyRoles(guild, userId) {
    if (!config.APPROVE_ADD_ROLE_ID && !config.APPROVE_REMOVE_ROLE_ID) return

    const member = await guild.members.fetch(userId).catch(() => null)
    if (!member) throw new Error('The requester is no longer in the server.')

    if (config.APPROVE_ADD_ROLE_ID) await member.roles.add(config.APPROVE_ADD_ROLE_ID, 'SV request approved')
    if (config.APPROVE_REMOVE_ROLE_ID) await member.roles.remove(config.APPROVE_REMOVE_ROLE_ID, 'SV request approved')
}

async function sendDm(client, userId, decision, by, note, cooldownUntil) {
    const approved = decision === 'approved'
    const lines = [
        approved ? config.text.approvedDm : config.text.deniedDm,
        '',
        `**Reviewed by:** ${by.tag}`,
    ]
    if (note) lines.push(`**${approved ? 'Note' : 'Reason'}:** ${note}`)
    if (cooldownUntil) lines.push(`You can send another request <t:${unix(cooldownUntil)}:R>.`)

    const container = newContainer()
        .addTextDisplayComponents(
            text(`## ${approved ? '✅' : '❌'} ${config.text.title} ${approved ? 'Approved' : 'Denied'}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(text(lines.join('\n')))

    try {
        const user = await client.users.fetch(userId)
        await user.send({ components: [addFooter(container)], flags: MessageFlags.IsComponentsV2 })
        return true
    } catch {
        return false
    }
}

async function handleDecisionSubmit(interaction, decision, userId) {
    if (!isReviewer(interaction.member)) return ephemeral(interaction, 'You can\'t review SV requests.')

    const messageId = interaction.message.id
    if (handling.has(messageId)) return ephemeral(interaction, 'This request is already being handled.')
    handling.add(messageId)

    try {
        const data = store.load()
        const request = data.pending[userId]

        if (!request || request.messageId !== messageId) {
            return ephemeral(interaction, 'This request was already handled.')
        }

        await interaction.deferUpdate()

        const approved = decision === 'approve'
        const note = interaction.fields.getTextInputValue('note').trim()

        if (approved) {
            try {
                await applyRoles(interaction.guild, userId)
            } catch (err) {
                console.error('[SV] Failed to update roles:', err.message)
                return interaction.followUp({
                    content: `Couldn't update roles: ${err.message}\nMake sure the bot has **Manage Roles** and is above those roles. The request is still pending.`,
                    flags: MessageFlags.Ephemeral,
                })
            }
        }

        let cooldownUntil = null
        if (!approved && config.DENY_COOLDOWN_MINUTES > 0) {
            cooldownUntil = Date.now() + config.DENY_COOLDOWN_MINUTES * 60_000
            data.cooldowns[userId] = cooldownUntil
        }
        delete data.pending[userId]
        store.save(data)

        const result = approved ? 'approved' : 'denied'
        const dmSent = await sendDm(interaction.client, userId, result, interaction.user, note, cooldownUntil)

        await interaction.editReply({
            ...buildRequest(userId, request, {
                decision: result,
                by: interaction.user.id,
                at: Date.now(),
                note,
                dmFailed: !dmSent,
            }),
            allowedMentions: { parse: [] },
        })
    } finally {
        handling.delete(messageId)
    }
}

// ---------- Router ----------

async function handleSVInteraction(interaction) {
    const [, action, userId] = interaction.customId.split(':')

    if (interaction.isButton()) {
        if (action === 'approve') return handleDecisionButton(interaction, 'approve', userId)
        if (action === 'deny') return handleDecisionButton(interaction, 'deny', userId)
    }

    if (interaction.isModalSubmit()) {
        if (action === 'form') return handleFormSubmit(interaction)
        if (action === 'approveform') return handleDecisionSubmit(interaction, 'approve', userId)
        if (action === 'denyform') return handleDecisionSubmit(interaction, 'deny', userId)
    }
}

module.exports = { startRequest, handleSVInteraction }
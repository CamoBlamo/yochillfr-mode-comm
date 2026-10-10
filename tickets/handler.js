const {
    ChannelType,
    PermissionFlagsBits,
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
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    AttachmentBuilder,
    FileBuilder,
    ModalBuilder,
    LabelBuilder,
    TextInputBuilder,
    TextInputStyle,
} = require('discord.js')
const config = require('./config')
const store = require('./store')

const creating = new Set()
const closing = new Set()

// ---------- Helpers ----------

const text = (content) => new TextDisplayBuilder().setContent(content)
const separator = (spacing = SeparatorSpacingSize.Small) =>
    new SeparatorBuilder().setDivider(true).setSpacing(spacing)
const unix = (ms = Date.now()) => Math.floor(ms / 1000)
const pad = (n) => String(n).padStart(4, '0')
const quote = (s) => s.split('\n').map((l) => `> ${l}`).join('\n')
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

// Status emoji at the front of the ticket channel name
const STATUS = { open: '🟡', claimed: '🟢' }
const stripStatus = (name) => name.replace(/^(🟡|🟢)-?/u, '')

// Banner only on the main panel; every other container is footer only
function newContainer(banner = false) {
    const c = new ContainerBuilder()
    if (banner && config.branding.bannerUrl) {
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(config.branding.bannerUrl))
        )
    }
    return c
}

// ...and ends with the footer text and/or footer image
function addFooter(c) {
    const { footer, footerImageUrl } = config.branding
    if (!footer && !footerImageUrl) return c

    c.addSeparatorComponents(separator())
    if (footer) c.addTextDisplayComponents(text(`-# ${footer}`))
    if (footerImageUrl) {
        c.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(footerImageUrl))
        )
    }
    return c
}

const v2 = (container, extra = {}) => ({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    ...extra,
})

function answersBlock(answers, maxEach = 1000) {
    return answers
        .map((a) => `**${a.label}**\n${a.value ? quote(truncate(a.value, maxEach)) : '> *Not provided*'}`)
        .join('\n\n')
}

// Ticket state lives in the channel topic so it survives bot restarts
// Format: ticket:<openerId>:<categoryKey>:<claimerId|none>
function parseTopic(topic) {
    if (!topic?.startsWith('ticket:')) return null
    const [, openerId, category, claimerId] = topic.split(':')
    return { openerId, category, claimerId: claimerId === 'none' ? null : claimerId }
}

function buildTopic({ openerId, category, claimerId }) {
    return `ticket:${openerId}:${category}:${claimerId ?? 'none'}`
}

// Internal Affairs or higher = has any role in CLAIM_ROLE_IDS (or is the server owner)
function isIAOrHigher(member) {
    if (member.id === member.guild.ownerId) return true
    if (!config.CLAIM_ROLE_IDS.length) return false
    return member.roles.cache.hasAny(...config.CLAIM_ROLE_IDS)
}

function findOpenTicket(guild, userId, key) {
    return guild.channels.cache.find((c) => {
        const t = parseTopic(c.topic)
        return t?.openerId === userId && t?.category === key
    })
}

// ---------- Panel ----------

function buildPanel() {
    const { panel, categories } = config

    const list = Object.values(categories)
        .map((c) => `- ${c.emoji} **${c.label}:** ${c.description}`)
        .join('\n')

    const select = new StringSelectMenuBuilder()
        .setCustomId('ticket:select')
        .setPlaceholder(panel.placeholder)
        .addOptions(
            Object.entries(categories).map(([key, c]) =>
                new StringSelectMenuOptionBuilder()
                    .setLabel(c.label)
                    .setValue(key)
                    .setDescription(c.description.slice(0, 100))
                    .setEmoji(c.emoji)
            )
        )

    const container = newContainer(true)
        .addTextDisplayComponents(
            text(`# ${panel.title}`),
            text(`> ${panel.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(text(`### Choose your category\n${list}`))
        .addSeparatorComponents(separator())
        .addActionRowComponents(new ActionRowBuilder().addComponents(select))

    return v2(addFooter(container))
}

// ---------- Ticket message ----------

function buildTicketContainer(data, info = {}) {
    const cat = config.categories[data.category]
    const claimed = Boolean(data.claimerId)
    const roleMentions = (cat?.roleIds ?? []).map((id) => `<@&${id}>`).join(' ')
    const number = info.number ? ` · #${pad(info.number)}` : ''

    const status = claimed
        ? `🟢 Claimed by <@${data.claimerId}>${info.claimedAt ? ` <t:${unix(info.claimedAt)}:R>` : ''}`
        : '🟡 Waiting for staff'

    const opened = info.openedAt
        ? `<t:${unix(info.openedAt)}:F> (<t:${unix(info.openedAt)}:R>)`
        : 'Unknown'

    const container = newContainer()
        .addTextDisplayComponents(
            text(`## ${cat?.emoji ?? '🎫'} ${cat?.label ?? 'Ticket'}${number}`),
            text(
                `Welcome <@${data.openerId}>! Thanks for reaching out. A member of our team will be with you shortly.\n` +
                '-# Please don\'t ping staff. Add any extra info or evidence below while you wait.'
            )
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Ticket Information\n' +
                `**Opened by:** <@${data.openerId}>\n` +
                `**Category:** ${cat?.label ?? data.category}\n` +
                `**Opened:** ${opened}\n` +
                `**Status:** ${status}`
            )
        )

    if (info.answers?.length) {
        container
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(text(`### Opening Details\n${answersBlock(info.answers)}`))
    }

    if (roleMentions) container.addTextDisplayComponents(text(`-# ${roleMentions}`))

    container
        .addSeparatorComponents(separator())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket:claim')
                    .setLabel(claimed ? 'Claimed' : 'Claim')
                    .setEmoji('🙋')
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(claimed),
                new ButtonBuilder()
                    .setCustomId('ticket:close')
                    .setLabel('Close')
                    .setEmoji('🔒')
                    .setStyle(ButtonStyle.Danger)
            )
        )

    return addFooter(container)
}

// ---------- Open: pick category -> form ----------

function buildOpenModal(key, cat) {
    const labels = (cat.questions ?? []).slice(0, 5).map((q, i) => {
        const input = new TextInputBuilder()
            .setCustomId(`q${i}`)
            .setStyle(q.style === 'short' ? TextInputStyle.Short : TextInputStyle.Paragraph)
            .setRequired(q.required !== false)
            .setMaxLength(q.maxLength ?? 1000)
        if (q.minLength) input.setMinLength(q.minLength)
        if (q.placeholder) input.setPlaceholder(q.placeholder.slice(0, 100))

        const label = new LabelBuilder()
            .setLabel(q.label.slice(0, 45))
            .setTextInputComponent(input)
        if (q.description) label.setDescription(q.description.slice(0, 100))
        return label
    })

    return new ModalBuilder()
        .setCustomId(`ticket:open:${key}`)
        .setTitle(`${cat.label} Ticket`.slice(0, 45))
        .addLabelComponents(...labels)
}

async function handleSelect(interaction) {
    const key = interaction.values[0]
    const cat = config.categories[key]
    const userId = interaction.user.id

    // Reset the dropdown and tell them why they can't open one
    const block = async (content) => {
        await interaction.update(buildPanel())
        await interaction.followUp({ content, flags: MessageFlags.Ephemeral })
    }

    if (!cat) return block('Unknown category.')
    if (creating.has(`${userId}:${key}`)) return block(`Your ${cat.label} ticket is already being created.`)

    const existing = findOpenTicket(interaction.guild, userId, key)
    if (existing) return block(`You already have an open ${cat.label} ticket: ${existing}`)

    if (!cat.questions?.length) return createTicket(interaction, key, cat, [])

    await interaction.showModal(buildOpenModal(key, cat))
}

async function handleOpenSubmit(interaction, key) {
    const cat = config.categories[key]
    if (!cat) return interaction.reply({ content: 'Unknown category.', flags: MessageFlags.Ephemeral })

    const answers = cat.questions.slice(0, 5).map((q, i) => ({
        label: q.label,
        value: interaction.fields.getTextInputValue(`q${i}`).trim(),
    }))

    await createTicket(interaction, key, cat, answers)
}

async function createTicket(interaction, key, cat, answers) {
    const userId = interaction.user.id
    const guild = interaction.guild
    const lockKey = `${userId}:${key}`

    // Reset the panel dropdown, then talk to the user ephemerally
    await interaction.update(buildPanel())
    const ephemeral = (content) => interaction.followUp({ content, flags: MessageFlags.Ephemeral })

    // Re-check in case they opened two forms at once
    if (creating.has(lockKey)) return ephemeral(`Your ${cat.label} ticket is already being created.`)
    const existing = findOpenTicket(guild, userId, key)
    if (existing) return ephemeral(`You already have an open ${cat.label} ticket: ${existing}`)

    creating.add(lockKey)
    try {
        const data = { openerId: userId, category: key, claimerId: null }
        const info = { number: store.nextNumber(), answers, openedAt: Date.now() }

        const access = [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
            PermissionFlagsBits.ReadMessageHistory,
            PermissionFlagsBits.AttachFiles,
            PermissionFlagsBits.EmbedLinks,
        ]
        const staffRoleIds = [...new Set([...config.CLAIM_ROLE_IDS, ...cat.roleIds])].filter(Boolean)

        // Server nickname > global display name > username
        const cleanName = (n) => (n || '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\p{L}\p{N}_-]/gu, '')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')

        const displayName = cleanName(interaction.member.displayName) || cleanName(interaction.user.username)
        const name = [STATUS.open, cat.channelPrefix, displayName].filter(Boolean).join('-').slice(0, 90)

        const channel = await guild.channels.create({
            name,
            type: ChannelType.GuildText,
            parent: cat.parentId || null,
            topic: buildTopic(data),
            permissionOverwrites: [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: userId, allow: access },
                ...staffRoleIds.map((id) => ({ id, allow: access })),
                { id: interaction.client.user.id, allow: [...access, PermissionFlagsBits.ManageChannels] },
            ],
        })

        store.set(channel.id, info)

        await channel.send(v2(buildTicketContainer(data, info), {
            allowedMentions: { users: [userId], roles: cat.roleIds },
        }))

        await ephemeral(`Your ticket has been created: ${channel}`)
    } finally {
        creating.delete(lockKey)
    }
}

// ---------- Claim ----------

async function handleClaim(interaction) {
    const ephemeral = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral })
    const data = parseTopic(interaction.channel.topic)

    if (!data) return ephemeral('This isn\'t a ticket channel.')
    if (!isIAOrHigher(interaction.member)) {
        return ephemeral('Only Internal Affairs or higher can claim tickets.')
    }
    if (data.claimerId) return ephemeral(`This ticket is already claimed by <@${data.claimerId}>.`)

    data.claimerId = interaction.user.id
    const info = store.get(interaction.channel.id)
    info.claimedAt = Date.now()
    store.set(interaction.channel.id, info)

    await interaction.update(v2(buildTicketContainer(data, info)))

    // One edit for topic + name (channel renames are rate limited)
    await interaction.channel.edit({
        topic: buildTopic(data),
        name: `${STATUS.claimed}-${stripStatus(interaction.channel.name)}`,
    }).catch((err) => console.error('[Tickets] Failed to update channel on claim:', err))

    const notice = newContainer().addTextDisplayComponents(
        text(
            '### 🙋 Ticket Claimed\n' +
            `<@${data.openerId}>, your ticket has been claimed by ${interaction.user}. They'll be assisting you from here.`
        )
    )

    await interaction.channel.send(v2(addFooter(notice), {
        allowedMentions: { users: [data.openerId] },
    }))
}

// ---------- Close ----------

function closeCheck(interaction, data) {
    if (!data) return 'This isn\'t a ticket channel.'

    if (data.claimerId) {
        if (interaction.user.id !== data.claimerId) {
            return `Only the claimer (<@${data.claimerId}>) can close this ticket.`
        }
    } else if (!isIAOrHigher(interaction.member) && interaction.user.id !== data.openerId) {
        return 'Only Internal Affairs or the ticket opener can close an unclaimed ticket.'
    }

    if (closing.has(interaction.channel.id)) return 'This ticket is already closing.'
    return null
}

async function handleClose(interaction) {
    const error = closeCheck(interaction, parseTopic(interaction.channel.topic))
    if (error) return interaction.reply({ content: error, flags: MessageFlags.Ephemeral })

    const modal = new ModalBuilder()
        .setCustomId('ticket:closereason')
        .setTitle('Close Ticket')
        .addLabelComponents(
            new LabelBuilder()
                .setLabel('Reason for closing')
                .setDescription('Optional. Shown in the transcript and sent to the opener.')
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

async function handleCloseSubmit(interaction) {
    const channel = interaction.channel
    const data = parseTopic(channel.topic)

    // Re-check: someone else may have claimed/closed while the form was open
    const error = closeCheck(interaction, data)
    if (error) return interaction.reply({ content: error, flags: MessageFlags.Ephemeral })

    closing.add(channel.id)

    const reason = interaction.fields.getTextInputValue('reason').trim() || 'No reason given'
    const info = store.get(channel.id)
    const deleteAt = Date.now() + config.CLOSE_DELAY_MS

    const notice = newContainer().addTextDisplayComponents(
        text(
            '### 🔒 Ticket Closing\n' +
            `**Closed by:** ${interaction.user}\n` +
            `**Reason:** ${reason}\n\n` +
            `Saving transcript. This channel will be deleted <t:${unix(deleteAt)}:R>.`
        )
    )
    await interaction.reply(v2(addFooter(notice), { allowedMentions: { parse: [] } }))

    try {
        await sendTranscript(channel, data, info, interaction.user, reason)
    } catch (err) {
        console.error('[Tickets] Transcript failed:', err)
        closing.delete(channel.id)
        return channel.send('Transcript failed to save, so the channel was **not** deleted. Check the console and try again.')
    }

    if (config.DM_ON_CLOSE) await dmOpener(interaction.client, data, info, interaction.user, reason)

    setTimeout(() => {
        channel.delete(`Ticket closed by ${interaction.user.tag}`)
            .then(() => store.remove(channel.id))
            .catch((err) => console.error('[Tickets] Failed to delete channel:', err))
            .finally(() => closing.delete(channel.id))
    }, config.CLOSE_DELAY_MS)
}

async function dmOpener(client, data, info, closedBy, reason) {
    const user = await client.users.fetch(data.openerId).catch(() => null)
    if (!user) return

    const cat = config.categories[data.category]
    const number = info.number ? ` #${pad(info.number)}` : ''

    const container = newContainer().addTextDisplayComponents(
        text(
            `### 🔒 Your ticket${number} was closed\n` +
            `**Category:** ${cat?.label ?? data.category}\n` +
            `**Closed by:** ${closedBy.tag}\n` +
            `**Reason:** ${reason}\n\n` +
            'If you still need help, feel free to open a new ticket.'
        )
    )

    await user.send(v2(addFooter(container))).catch(() => {})
}

// ---------- Transcript ----------

async function fetchAllMessages(channel) {
    const all = []
    let before

    while (true) {
        const batch = await channel.messages.fetch({ limit: 100, before })
        if (batch.size === 0) break
        all.push(...batch.values())
        before = batch.last().id
        if (batch.size < 100) break
    }

    return all.reverse()
}

// Pull text out of Components V2 messages
function extractText(components = []) {
    const out = []
    for (const c of components) {
        if (typeof c.content === 'string') out.push(c.content)
        if (Array.isArray(c.components)) out.push(...extractText(c.components))
    }
    return out
}

const formatDate = (d) => new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'

async function buildTranscript(channel, data, info, closedBy, reason) {
    const messages = await fetchAllMessages(channel)
    const cat = config.categories[data.category]
    const users = channel.client.users.cache
    const who = (id) => (id ? `${users.get(id)?.tag ?? 'Unknown'} (${id})` : 'Unclaimed')
    const openedAt = info.openedAt ?? channel.createdTimestamp

    const lines = [
        `Ticket: #${channel.name}${info.number ? ` (#${pad(info.number)})` : ''}`,
        `Category: ${cat?.label ?? data.category}`,
        `Opened by: ${who(data.openerId)}`,
        `Claimed by: ${who(data.claimerId)}`,
        `Closed by: ${closedBy.tag} (${closedBy.id})`,
        `Close reason: ${reason}`,
        `Opened at: ${formatDate(openedAt)}`,
        info.claimedAt ? `Claimed at: ${formatDate(info.claimedAt)}` : null,
        `Closed at: ${formatDate(Date.now())}`,
        `Messages: ${messages.length}`,
    ].filter(Boolean)

    if (info.answers?.length) {
        lines.push('', '--- Opening Details ---')
        for (const a of info.answers) lines.push(`${a.label}:`, a.value || '(not provided)', '')
    }

    lines.push('='.repeat(60), '')

    for (const m of messages) {
        const parts = []
        if (m.content) parts.push(m.content)
        parts.push(...extractText(m.components))
        for (const e of m.embeds) {
            if (e.title) parts.push(`[Embed] ${e.title}`)
            if (e.description) parts.push(e.description)
        }
        for (const a of m.attachments.values()) parts.push(`[Attachment] ${a.url}`)

        lines.push(`[${formatDate(m.createdTimestamp)}] ${m.author.tag} (${m.author.id})`)
        lines.push(parts.length ? parts.join('\n') : '[no content]')
        lines.push('')
    }

    return { body: lines.join('\n'), count: messages.length }
}

async function sendTranscript(channel, data, info, closedBy, reason) {
    const { body, count } = await buildTranscript(channel, data, info, closedBy, reason)
    const cat = config.categories[data.category]
    const fileName = `${stripStatus(channel.name) || 'ticket'}.txt`
    const openedAt = info.openedAt ?? channel.createdTimestamp
    const number = info.number ? ` · #${pad(info.number)}` : ''

    const transcriptChannel = await channel.client.channels.fetch(config.TRANSCRIPT_CHANNEL_ID)

    const container = newContainer()
        .addTextDisplayComponents(text(`## 🔒 Ticket Closed${number}`))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Ticket Information\n' +
                `**Ticket:** #${channel.name}\n` +
                `**Category:** ${cat?.emoji ?? ''} ${cat?.label ?? data.category}\n` +
                `**Opened by:** <@${data.openerId}>\n` +
                `**Claimed by:** ${data.claimerId ? `<@${data.claimerId}>` : 'Unclaimed'}\n` +
                `**Closed by:** ${closedBy}\n` +
                `**Opened:** <t:${unix(openedAt)}:F>\n` +
                `**Messages:** ${count}`
            )
        )

    if (info.answers?.length) {
        container
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(text(`### Opening Details\n${answersBlock(info.answers, 400)}`))
    }

    container
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(text(`### Close Reason\n${quote(reason)}`))
        .addSeparatorComponents(separator())
        .addFileComponents(new FileBuilder().setURL(`attachment://${fileName}`))

    await transcriptChannel.send(v2(addFooter(container), {
        files: [new AttachmentBuilder(Buffer.from(body, 'utf8'), { name: fileName })],
        allowedMentions: { parse: [] },
    }))
}

// ---------- Router ----------

async function handleTicketInteraction(interaction) {
    const [, action, arg] = interaction.customId.split(':')

    if (interaction.isStringSelectMenu() && action === 'select') return handleSelect(interaction)

    if (interaction.isButton()) {
        if (action === 'claim') return handleClaim(interaction)
        if (action === 'close') return handleClose(interaction)
    }

    if (interaction.isModalSubmit()) {
        if (action === 'open') return handleOpenSubmit(interaction, arg)
        if (action === 'closereason') return handleCloseSubmit(interaction)
    }
}

module.exports = { buildPanel, handleTicketInteraction }
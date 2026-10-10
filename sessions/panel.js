const {
    MessageFlags,
    ContainerBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js')
const config = require('./config')
const store = require('./store')
const { getServerData } = require('./erlc')
const { text, separator, unix, image, bulletList, isManager, imagesFor } = require('./util')

// ---------- Panel ----------

async function buildPanel() {
    const { panel } = config
    const { session, vote } = store.load()
    const server = await getServerData()
    const online = session.active
    const { banner, footer } = imagesFor(panel)

    const container = new ContainerBuilder()

    if (banner) container.addMediaGalleryComponents(image(banner))

    container
        .addTextDisplayComponents(
            text(`## ${panel.titleEmoji ? `${panel.titleEmoji} ` : ''}${panel.title}`),
            text(`> ${panel.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### ERLC Server Information\n' +
                bulletList([
                    ['Server Owner', server.owner],
                    ['Server Name', server.name],
                    ['Server Join Code', server.joinCode],
                ])
            )
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### ERLC Server Stats\n' +
                bulletList([
                    ['Players', server.players == null ? 'N/A' : `${server.players}/${server.maxPlayers}`],
                    ['Staff Online', server.staff],
                    ['Queue', server.queue],
                ])
            )
        )

    const status = online
        ? { label: 'Online', emoji: '🟢', style: ButtonStyle.Success }
        : vote
            ? { label: 'Vote in Progress', emoji: config.vote.voteEmoji, style: ButtonStyle.Primary }
            : { label: 'Offline', emoji: '🔴', style: ButtonStyle.Danger }

    const buttons = [
        new ButtonBuilder()
            .setCustomId('session:status')
            .setLabel(status.label)
            .setEmoji(status.emoji)
            .setStyle(status.style)
            .setDisabled(true),
        new ButtonBuilder()
            .setCustomId('session:notify')
            .setLabel('Session Notification')
            .setEmoji(panel.notifyEmoji)
            .setStyle(ButtonStyle.Secondary),
    ]

    if (server.joinCode) {
        const quickJoin = new ButtonBuilder()
            .setLabel('Quick Join')
            .setStyle(ButtonStyle.Link)
            .setURL(config.QUICK_JOIN_URL.replace('{code}', encodeURIComponent(server.joinCode)))
        if (panel.quickJoinEmoji) quickJoin.setEmoji(panel.quickJoinEmoji)
        buttons.push(quickJoin)
    }

    const activeLine = online && session.startedAt
        ? `Session active since <t:${unix(session.startedAt)}:R>`
        : vote
            ? `Session vote in progress (${vote.voters.length}/${vote.required})`
            : 'No active session'

    container
        .addActionRowComponents(new ActionRowBuilder().addComponents(...buttons))
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(text(`-# ${activeLine} · Last updated <t:${unix()}:R>`))

    if (footer) container.addMediaGalleryComponents(image(footer))

    return {
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    }
}

// ---------- Post + keep updated ----------

async function postPanel(channel) {
    const message = await channel.send(await buildPanel())

    const data = store.load()
    data.panel = { channelId: channel.id, messageId: message.id }
    store.save(data)

    return message
}

let updating = false

async function updatePanel(client) {
    if (updating) return
    updating = true

    try {
        const data = store.load()
        if (!data.panel) return

        const channel = await client.channels.fetch(data.panel.channelId).catch(() => null)
        const message = channel && await channel.messages.fetch(data.panel.messageId).catch((err) => {
            if (err.code === 10008) return null // Unknown Message (deleted)
            throw err
        })

        // Panel was deleted: stop updating until it's reposted
        if (!message) {
            data.panel = null
            store.save(data)
            console.warn('[Sessions] Panel message not found. Repost it with the panel command.')
            return
        }

        const { allowedMentions, ...payload } = await buildPanel()
        await message.edit(payload)
    } catch (err) {
        console.error('[Sessions] Failed to update panel:', err.message)
    } finally {
        updating = false
    }
}

function initSessions(client) {
    client.once('clientReady', () => {
        updatePanel(client)
        setInterval(() => updatePanel(client), config.UPDATE_INTERVAL_SECONDS * 1000)
    })
}

// ---------- Buttons ----------

async function handleNotify(interaction) {
    const ephemeral = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral })
    const roleId = config.SESSION_PING_ROLE_ID

    if (!roleId) return ephemeral('Session notifications aren\'t set up yet.')

    const member = interaction.member
    const hasRole = member.roles.cache.has(roleId)

    try {
        if (hasRole) {
            await member.roles.remove(roleId, 'Session notifications off')
            return ephemeral('🔕 You will **no longer** be notified for sessions.')
        }
        await member.roles.add(roleId, 'Session notifications on')
        return ephemeral('🔔 You will now be notified when sessions start.')
    } catch (err) {
        console.error('[Sessions] Failed to toggle notification role:', err.message)
        return ephemeral('Couldn\'t update your role. Let staff know.')
    }
}

async function handleSessionInteraction(interaction) {
    if (!interaction.isButton()) return

    // Required here (not at the top) to avoid a circular import with vote.js
    const vote = require('./vote')

    switch (interaction.customId) {
        case 'session:notify': return handleNotify(interaction)
        case 'session:vote': return vote.handleVote(interaction)
        case 'session:voters': return vote.handleVoters(interaction)
    }
}

module.exports = { buildPanel, postPanel, updatePanel, initSessions, handleSessionInteraction, isManager }
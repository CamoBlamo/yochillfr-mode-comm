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
const { text, separator, unix, image, bulletList, imagesFor } = require('./util')
const { updatePanel } = require('./panel')
const { finishVoteMessage } = require('./vote')

const MAX_VOTER_PINGS = 80

// ---------- Status channels (Server Status: Open/Closed) ----------

// Flips the status voice channels if that system is set up. Never throws.
async function syncStatusChannels(guild, status) {
    if (!config.SYNC_STATUS_CHANNELS) return
    try {
        const statusStore = require('../status/store')
        const { updateGuild } = require('../status/updater')

        const data = statusStore.getGuild(guild.id)
        if (!Object.keys(data.channels).length) return

        data.state.status = status
        statusStore.setGuild(guild.id, data)
        updateGuild(guild)
    } catch (err) {
        console.error('[Sessions] Failed to sync status channels:', err.message)
    }
}

// ---------- Startup message ----------

// endedAt set = the session is over: Quick Join is removed and an ended line is shown
function buildSsuMessage({ hostId, startedAt, voters, server, endedAt = null, endedBy = null }) {
    const s = config.ssu
    const { banner, footer } = imagesFor(s)
    const pingRole = config.SESSION_PING_ROLE_ID

    const container = new ContainerBuilder()
    if (banner) container.addMediaGalleryComponents(image(banner))

    container
        .addTextDisplayComponents(
            text(`## ${s.titleEmoji ? `${s.titleEmoji} ` : ''}${s.title}`),
            text(`> ${s.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Session Information\n' +
                bulletList([
                    ['Host', `<@${hostId}>`, true],
                    ['Started', `<t:${unix(startedAt)}:F>`, true],
                    ['Server Name', server.name],
                    ['Server Join Code', server.joinCode],
                ])
            )
        )

    if (endedAt) {
        container
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(
                text(`🔴 **Session ended** <t:${unix(endedAt)}:R>${endedBy ? ` by <@${endedBy}>` : ''}.`)
            )
    } else if (server.joinCode) {
        const quickJoin = new ButtonBuilder()
            .setLabel('Quick Join')
            .setStyle(ButtonStyle.Link)
            .setURL(config.QUICK_JOIN_URL.replace('{code}', encodeURIComponent(server.joinCode)))
        if (config.panel.quickJoinEmoji) quickJoin.setEmoji(config.panel.quickJoinEmoji)

        container
            .addSeparatorComponents(separator())
            .addActionRowComponents(new ActionRowBuilder().addComponents(quickJoin))
    }

    const pings = []
    if (pingRole) pings.push(`<@&${pingRole}>`)
    if (voters.length) pings.push(`Voters: ${voters.map((id) => `<@${id}>`).join(' ')}`)
    if (pings.length) container.addTextDisplayComponents(text(`-# ${pings.join(' · ')}`))

    if (footer) container.addMediaGalleryComponents(image(footer))

    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

// ---------- Shutdown message ----------

function buildSsdMessage({ hostId, startedAt, endedAt, endedBy }) {
    const s = config.ssd
    const { banner, footer } = imagesFor(s)
    const pingRole = config.SESSION_PING_ROLE_ID

    const container = new ContainerBuilder()
    if (banner) container.addMediaGalleryComponents(image(banner))

    container
        .addTextDisplayComponents(
            text(`## ${s.titleEmoji ? `${s.titleEmoji} ` : ''}${s.title}`),
            text(`> ${s.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Session Summary\n' +
                bulletList([
                    ['Host', `<@${hostId}>`, true],
                    ['Ended by', `<@${endedBy}>`, true],
                    ['Started', `<t:${unix(startedAt)}:F>`, true],
                    ['Ended', `<t:${unix(endedAt)}:F>`, true],
                ])
            )
        )

    if (s.pingRole && pingRole) container.addTextDisplayComponents(text(`-# <@&${pingRole}>`))
    if (footer) container.addMediaGalleryComponents(image(footer))

    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

// ---------- Start ----------

async function startSession(channel, hostId) {
    const data = store.load()
    if (data.session.active) return { error: 'A session is already active. End it before starting a new one.' }

    const vote = data.vote
    const voters = config.ssu.pingVoters ? (vote?.voters ?? []).slice(0, MAX_VOTER_PINGS) : []
    const startedAt = Date.now()
    const server = await getServerData()

    const message = await channel.send({
        ...buildSsuMessage({ hostId, startedAt, voters, server }),
        allowedMentions: {
            roles: config.SESSION_PING_ROLE_ID ? [config.SESSION_PING_ROLE_ID] : [],
            users: voters,
        },
    })

    data.session = {
        active: true,
        startedAt,
        hostId,
        channelId: channel.id,
        messageId: message.id,
        voters: vote?.voters ?? [],
    }
    data.vote = null
    store.save(data)

    if (vote) await finishVoteMessage(channel.client, vote, 'started', hostId)
    await syncStatusChannels(channel.guild, 'open')
    updatePanel(channel.client)

    return { message }
}

// ---------- End ----------

async function endSession(channel, endedBy) {
    const data = store.load()
    const session = data.session
    if (!session.active) return { error: 'There is no active session to end.' }

    const endedAt = Date.now()
    const startedAt = session.startedAt ?? endedAt
    const hostId = session.hostId ?? endedBy

    // Mark ended first so a failed message send can't leave the session stuck "Online"
    data.session = { active: false, startedAt: null }
    store.save(data)

    const pingRole = config.ssd.pingRole && config.SESSION_PING_ROLE_ID
    const message = await channel.send({
        ...buildSsdMessage({ hostId, startedAt, endedAt, endedBy }),
        allowedMentions: { roles: pingRole ? [pingRole] : [], users: [] },
    })

    // Update the startup message: remove Quick Join, show it ended
    if (session.channelId && session.messageId) {
        const ssuChannel = await channel.client.channels.fetch(session.channelId).catch(() => null)
        const ssuMessage = ssuChannel && await ssuChannel.messages.fetch(session.messageId).catch(() => null)
        if (ssuMessage) {
            const voters = config.ssu.pingVoters ? (session.voters ?? []).slice(0, MAX_VOTER_PINGS) : []
            await ssuMessage.edit({
                ...buildSsuMessage({ hostId, startedAt, voters, server: await getServerData(), endedAt, endedBy }),
                allowedMentions: { parse: [] },
            }).catch((err) => console.error('[Sessions] Failed to mark startup ended:', err.message))
        }
    }

    await syncStatusChannels(channel.guild, 'closed')
    updatePanel(channel.client)

    return { message }
}

module.exports = { startSession, endSession, buildSsuMessage, buildSsdMessage, syncStatusChannels }
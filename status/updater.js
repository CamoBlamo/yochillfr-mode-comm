const { ChannelType, PermissionFlagsBits } = require('discord.js')
const config = require('./config')
const store = require('./store')

const running = new Set()
const queued = new Set()

// Discord only allows 2 renames per channel every 10 minutes. Anything past that
// gets held by Discord until the window resets, so we track it ourselves, skip
// the rename, and retry automatically once the window opens again.
const RENAME_LIMIT = 2
const RENAME_WINDOW_MS = 10 * 60_000
const renameLog = new Map() // channelId -> [timestamps]
const retryTimers = new Map() // guildId -> timeout

function renameWaitMs(channelId) {
    const now = Date.now()
    const recent = (renameLog.get(channelId) ?? []).filter((t) => now - t < RENAME_WINDOW_MS)
    renameLog.set(channelId, recent)
    return recent.length < RENAME_LIMIT ? 0 : recent[0] + RENAME_WINDOW_MS - now
}

function scheduleRetry(guild, waitMs) {
    if (retryTimers.has(guild.id)) return
    retryTimers.set(guild.id, setTimeout(() => {
        retryTimers.delete(guild.id)
        updateGuild(guild).catch((err) => console.error('[STATUS] Retry failed', err))
    }, waitMs + 2000))
}

async function getValues(guild) {
    const { state } = store.getGuild(guild.id)

    return {
        members: String(guild.memberCount),
        status: state.status === 'open' ? config.statusText.open : config.statusText.closed,
        code: state.code || 'N/A',
        invite: config.INVITE
    }
}

function render(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => values[key] ?? match).slice(0, 100)
}

async function updateGuild(guild) {
    if (running.has(guild.id)) {
        queued.add(guild.id)
        return
    }
    running.add(guild.id)

    try {
        const { channels } = store.getGuild(guild.id)
        if (!Object.keys(channels).length) return

        const values = await getValues(guild)

        await Promise.allSettled(
            config.channels.map(async (def) => {
                const id = channels[def.key]
                if (!id) return

                const channel = guild.channels.cache.get(id) ?? await guild.channels.fetch(id).catch(() => null)
                if (!channel) return

                const name = render(def.template, values)
                if (channel.name === name) return

                const waitMs = renameWaitMs(id)
                if (waitMs > 0) {
                    console.log(`[STATUS] "${def.key}" hit Discord's rename limit. Will update to "${name}" in ${Math.ceil(waitMs / 60_000)} min.`)
                    scheduleRetry(guild, waitMs)
                    return
                }

                renameLog.get(id).push(Date.now())
                await channel.setName(name).catch((err) => console.error(`[STATUS] Failed to rename ${def.key}:`, err.message))
            })
        )
    } finally {
        running.delete(guild.id)
        if (queued.delete(guild.id)) updateGuild(guild)
    }
}

function updateAll(client) {
    for (const guild of client.guilds.cache.values()) {
        updateGuild(guild).catch((err) => console.error(`[STATUS] Update failed`, err))
    }
}

async function setupGuild(guild) {
    const data = store.getGuild(guild.id)
    const values = await getValues(guild)

    const overwrites = [
        { id: guild.roles.everyone.id, allow: [PermissionFlagsBits.ViewChannel], deny: [PermissionFlagsBits.Connect] },
        { id: guild.client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.ManageChannels] },
    ]

    let category = data.categoryId && await guild.channels.fetch(data.categoryId).catch(() => null)
    if (!category) {
        category = await guild.channels.create({
            name: config.CATEGORY_NAME,
            type: ChannelType.GuildCategory,
            position: 0
        })
    }

    const channels = {}
    let created = 0

    for (const def of config.channels) {
        const existingId = data.channels[def.key]
        const existing = existingId && await guild.channels.fetch(existingId).catch(() => null)

        if (existing) {
            channels[def.key] = existing.id
            continue
        }

        const channel = await guild.channels.create({
            name: render(def.template, values),
            type: ChannelType.GuildVoice,
            parent: category.id,
            permissionOverwrites: overwrites
        })
        channels[def.key] = channel.id
        created++
    }

    store.setGuild(guild.id, { ...data, categoryId: category.id, channels })
    return { category, created }
}

function initStatus(client) {
    client.once('clientReady', () => {
        updateAll(client)
        setInterval(() => updateAll(client), config.UPDATE_INTERVAL_MINUTES * 60_000)
    })
}

module.exports = { initStatus, updateGuild, setupGuild, getValues }
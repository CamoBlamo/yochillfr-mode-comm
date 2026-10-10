const config = require('./config')
const { getServerInfo } = require('../utils/erlcApi')

// Panel refreshes every minute and SSU also asks for data, so don't hit ERLC more than this
const CACHE_MS = 30_000

let cache = null // { at, data }
let inflight = null
let loggedShape = false
let lastError = null

const robloxNames = new Map() // userId -> username

// ---------- Helpers ----------

function fallback() {
    return {
        owner: config.server.owner,
        name: config.server.name,
        joinCode: config.server.joinCode,
        players: null,
        maxPlayers: config.server.maxPlayers,
        staff: null,
        queue: null,
        online: false,
    }
}

// ERLC only gives the owner's Roblox ID, so look the username up once and cache it
async function robloxUsername(userId) {
    if (!userId) return null
    if (robloxNames.has(userId)) return robloxNames.get(userId)

    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${userId}`)
        if (!res.ok) throw new Error(`Roblox API ${res.status}`)
        const body = await res.json()
        robloxNames.set(userId, body.name)
        return body.name
    } catch (err) {
        console.error(`[ERLC] Couldn't look up Roblox user ${userId}:`, err.message)
        return null
    }
}

function count(value) {
    if (Array.isArray(value)) return value.length
    if (typeof value === 'number') return value
    return null
}

// Staff online = players in the server with a permission above Normal
function countStaff(body) {
    if (Array.isArray(body.Players)) {
        return body.Players.filter((p) => p?.Permission && p.Permission !== 'Normal').length
    }
    return null
}

async function parse(body) {
    const players = typeof body.CurrentPlayers === 'number' ? body.CurrentPlayers : count(body.Players)

    return {
        owner: (await robloxUsername(body.OwnerId)) ?? config.server.owner,
        name: body.Name ?? config.server.name,
        joinCode: body.JoinKey ?? config.server.joinCode,
        players,
        maxPlayers: body.MaxPlayers ?? config.server.maxPlayers,
        staff: countStaff(body),
        queue: count(body.Queue),
        online: true,
    }
}

// ---------- Main ----------

async function fetchServerData() {
    const body = await getServerInfo({ Players: true, Queue: true })

    if (!loggedShape) {
        loggedShape = true
        console.log('[ERLC] /server fields:', Object.keys(body).join(', '))
    }

    return parse(body)
}

// Never throws. Returns live data, the last good data, or the config placeholders.
async function getServerData() {
    if (cache && Date.now() - cache.at < CACHE_MS) return cache.data
    if (inflight) return inflight

    inflight = (async () => {
        try {
            const data = await fetchServerData()
            cache = { at: Date.now(), data }
            if (lastError) console.log('[ERLC] Connection restored.')
            lastError = null
            return data
        } catch (err) {
            // Only log when the error changes, not every minute
            if (err.message !== lastError) console.error('[ERLC] Failed to get server info:', err.message)
            lastError = err.message

            // ERLC answers but the private server itself is down
            if (/offline/i.test(err.message)) {
                const offline = { ...(cache?.data ?? fallback()), players: 0, staff: 0, queue: 0, online: false }
                cache = { at: Date.now(), data: offline }
                return offline
            }

            return cache?.data ?? fallback()
        } finally {
            inflight = null
        }
    })()

    return inflight
}

module.exports = { getServerData }
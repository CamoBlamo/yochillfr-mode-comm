//erlcapi.js

require('dotenv').config()

const BASE_URL = 'https://api.erlc.gg'
const COMMAND_COOLDOWN_MS = 5000

let lastCommandAt = 0

const serverKey = process.env.ERLC_SERVER_KEY
const apiKey = process.env.ERLC_API_KEY

function buildHeaders() {
    const headers = { 'server-key':  serverKey, 'Content-Type': 'application/json'}
    if (apiKey) headers['Authorization'] = apiKey
    return headers
}

async function runCommand(command) {
    const waitFor = COMMAND_COOLDOWN_MS - (Date.now() - lastCommandAt)
    if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor))
    lastCommandAt = Date.now()

    const res = await fetch(`${BASE_URL}/v2/server/command`, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify({ command })
    })

    const body = await res.json().catch(() => ({}))

    if (res.status === 429) {
        throw new Error(`Rate limited by ERLC API, retry after ${body.retry_after ?? '?'}s.`)
    }
    if (res.status === 422) {
        throw new Error(body.message || 'The private server is currently offline')
    }
    if (!res.ok) {
        throw new Error(body.message || `ERLC API Error (${res.status})`)
    }
    return body
}

async function getServerInfo(options = {}) {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(options)) {
        if (value) params.set(key, 'true')
    }
    const url = `${BASE_URL}/v2/server${params.toString() ? `?${params}` : ''}`

    const res = await fetch(url, { headers: buildHeaders() })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
        throw new Error(body.message || body.error || `ERLC API Error (${res.status})`)
    }
    return body
}

module.exports = { runCommand, getServerInfo }
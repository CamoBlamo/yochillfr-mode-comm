const fs = require('fs')
const path = require('path')
const config = require('./config')

const FILE = path.join(__dirname, '..', 'data', 'status.json')

function load() {
    try {
        return JSON.parse(fs.readFileSync(FILE, 'utf8'))
    } catch {
        return {}
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

function getGuild(guildId) {
    const g = load()[guildId] ?? {}
    return {
        categoryId: g.categoryId ?? null,
        channels: g.channels ?? {},
        state: { status: 'closed', code: config.GAME_CODE, ...g.state }
    }
}

function setGuild(guildId, value) {
    const data = load()
    data[guildId] = value,
    save(data)
}

module.exports = { getGuild, setGuild }
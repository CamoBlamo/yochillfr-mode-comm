// Saves panel location, session state and the active vote to data/sessions.json
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'data', 'sessions.json')

function load() {
    let data = {}
    try {
        data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
    } catch {}

    return {
        panel: data.panel ?? null, // { channelId, messageId }
        session: { active: false, startedAt: null, ...data.session },
        vote: data.vote ?? null, // { channelId, messageId, hostId, required, voters, startedAt, reached }
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

module.exports = { load, save }
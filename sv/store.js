const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'data', 'sv.json')

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
        return { pending: data.pending ?? {}, cooldowns: data.cooldowns ?? {} }
    } catch {
        return { pending: {}, cooldowns: {} }
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

module.exports = { load, save }
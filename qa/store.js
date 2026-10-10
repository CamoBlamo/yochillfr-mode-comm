// Saves cooldowns + pending submissions to data/qa.json so they survive restarts
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'data', 'qa.json')

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
        return { cooldowns: data.cooldowns ?? {}, pending: data.pending ?? {} }
    } catch {
        return { cooldowns: {}, pending: {} }
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

module.exports = { load, save }
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'data', 'tickets.json')

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
        return { counter: data.counter ?? 0, tickets: data.tickets ?? {} }
    } catch {
        return { counter: 0, tickets: {} }
    }
}

function save(data) {
    fs.mkdirSync(path.dirname(FILE), { recursive: true })
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2))
}

function nextNumber() {
    const data = load()
    data.counter++
    save(data)
    return data.counter
}

function get(channelId) {
    return load().tickets[channelId] ?? {}
}

function set(channelId, info) {
    const data = load()
    data.tickets[channelId] = info
    save(data)
}

function remove(channelId) {
    const data = load()
    delete data.tickets[channelId]
    save(data)
}

module.exports = { nextNumber, get, set, remove }
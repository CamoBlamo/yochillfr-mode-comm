require('dotenv').config()

const fs = require('fs')
const path = require('path')

const { Client, IntentsBitField, Collection, REST, Routes, MessageFlags } = require('discord.js')
const { handleTicketInteraction } = require('./tickets/handler')
const { handleQAInteraction } = require('./qa/handler')
const { initStatus } = require('./status/updater')
const { initSessions, handleSessionInteraction } = require('./sessions/panel')
const { handleSVInteraction } = require('./sv/handler')

const token = process.env.DISCORD_TOKEN
const clientId = process.env.DISCORD_CLIENT_ID
const guildId = process.env.DISCORD_GUILD_ID
const prefix = process.env.DISCORD_PREFIX

const client = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.MessageContent,
    ],
})

client.slashCommands = new Collection()
client.prefixCommands = new Collection()

initStatus(client)
initSessions(client)

function getAllFiles(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true })
        return []
    }

    let files = []
    for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            files = files.concat(getAllFiles(fullPath))
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push(fullPath)
        }
    }
    return files
}

function loadSlashCommands() {
    const dir = path.join(__dirname, 'commands')
    const files = getAllFiles(dir)
    const commandsJson = []

    for (const file of files) {
        delete require.cache[require.resolve(file)]
        const command = require(file)

        if (!command?.data || !command?.execute) {
            console.warn(`[SLASHCOMMANDS] Skipping ${file} - missing "data" or "execute" export.`)
            continue
        }

        client.slashCommands.set(command.data.name, command)
        commandsJson.push(command.data.toJSON ? command.data.toJSON() : command.data)
    }

    return commandsJson
}

function loadPrefixCommands() {
    const dir = path.join(__dirname, 'prefix')
    const files = getAllFiles(dir)

    for (const file of files) {
        delete require.cache[require.resolve(file)]
        const command = require(file)

        if (!command?.name || !command?.execute) {
            console.warn(`[PrefixCommands] Skipping ${file} — missing "name" or "execute" export.`)
            continue
        }

        client.prefixCommands.set(command.name, command)
        if (Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
                client.prefixCommands.set(alias, command)
            }
        }
    }
}

async function deploySlashCommands(commandsJson) {
    const rest = new REST().setToken(token)

    try {
        const route = guildId
            ? Routes.applicationGuildCommands(clientId, guildId)
            : Routes.applicationCommands(clientId)

        const data = await rest.put(route, { body: commandsJson })

        console.log(
            `Deployed ${data.length} slash command(s) ${
                guildId ? `to guild ${guildId}` : 'globally (may take up to 1hr to propagate)'
            }.`
        )
    } catch (err) {
        console.error('Failed to deploy slash commands', err)
    }
}

async function replyError(interaction, content) {
    const payload = { content, flags: MessageFlags.Ephemeral }
    if (interaction.replied || interaction.deferred) {
        await interaction.followUp(payload).catch(() => {})
    } else {
        await interaction.reply(payload).catch(() => {})
    }
}

const slashCommandsJson = loadSlashCommands()
loadPrefixCommands()

console.log(`Loaded ${client.slashCommands.size} slash commands`)
console.log(`Loaded ${client.prefixCommands.size} prefix commands`)

client.on('clientReady', async (c) => {
    console.log(`Logged in as ${c.user.tag}`)
    await deploySlashCommands(slashCommandsJson)
})

client.on('interactionCreate', async (interaction) => {
    // Buttons, select menus, modals
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        const id = interaction.customId
        const handlers = {
            ticket: handleTicketInteraction,
            qa: handleQAInteraction,
            session: handleSessionInteraction,
            sv: handleSVInteraction,
        }
        const handler = handlers[id.split(':')[0]]

        if (!handler) return

        try {
            await handler(interaction)
        } catch (err) {
            console.error(`Error handling interaction "${id}":`, err)
            await replyError(interaction, 'Something went wrong with that action.')
        }
        return
    }

    // Slash commands
    if (!interaction.isChatInputCommand()) return

    const command = client.slashCommands.get(interaction.commandName)
    if (!command) return

    try {
        await command.execute(interaction, client)
    } catch (err) {
        console.error(`Error executing slash command "${interaction.commandName}":`, err)
        await replyError(interaction, 'There was an error running that command.')
    }
})

client.on('messageCreate', async (message) => {
    if (message.author.bot) return
    if (!message.content.startsWith(prefix)) return

    const args = message.content.slice(prefix.length).trim().split(/\s+/)
    const commandName = args.shift().toLowerCase()

    const command = client.prefixCommands.get(commandName)
    if (!command) return

    try {
        await command.execute(message, args, client)
    } catch (err) {
        console.error(`Error executing prefix command "${commandName}":`, err)
        await message.reply('There was an error running that command.').catch(() => {})
    }
})

client.on('error', console.error)
client.on('warn', console.warn)

client.login(token).catch((err) => {
    console.error('Failed to log in:', err.message)
    process.exit(1)
})
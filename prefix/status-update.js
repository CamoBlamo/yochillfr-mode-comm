const { Message, Client, ContainerBuilder, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, PermissionFlagsBits } = require('discord.js')
const config = require('../status/config')
const store = require('../status/store')
const { updateGuild, getValues } = require('../status/updater')

function isManager(member) {
    if (config.MANAGER_ROLE_IDS.length) return member.roles.cache.hasAny(...config.MANAGER_ROLE_IDS)
    return member.permissions.has(PermissionFlagsBits.Administrator)
}

function reply(message, title, body) {
    return message.reply({
        flags: [MessageFlags.IsComponentsV2],
        allowedMentions: { repliedUser: false },
        components: [
            new ContainerBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`))
                .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small))
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(body)),
        ],
    })
}

module.exports = {
    name: 'status',
    description: 'set the server status: open, closed, code <code>, refresh',
    aliases: ['serverstatus'],

    /**
     * @param {Message} message
     * @param {string[]} args
     * @param {Client} client
    */
    async execute(message, args, client) {
        if (!message.inGuild()) return

        if (!isManager(message.member)) {
            return message.reply('You don\'t have permission to use this.')
        }

        const guild = message.guild
        const data = store.getGuild(guild.id)
        const sub = (args[0] || '').toLowerCase()

        if (!Object.keys(data.channels).length) {
            return reply(message, 'Not set up', `Run \`${process.env.DISCORD_PREFIX}status-setup\` first.`)
        }

        if (sub === 'open' || sub === 'closed' || sub === 'close') {
            data.state.status = sub === 'open' ? 'open' : 'closed'
            store.setGuild(guild.id, data)
            updateGuild(guild)
            return reply(message, 'Status updated', `Server Status: ${data.state.status === 'open' ? config.statusText.open : config.statusText.closed}`)
        }

        if (sub === 'code') {
            const code = args.slice(1).join(' ').trim()
            if (!code) return reply(message, 'Missing code', `Usage: \`${process.env.DISCORD_PREFIX}status code <code>\``)
            data.state.code = code.slice(0, 50)
            store.setGuild(guild.id, data)
            updateGuild(guild)
            return reply(message, 'Game code updated', `Game Code: ${data.state.code}`)
        }

        if (sub === 'refresh') {
            updateGuild(guild)
            return reply(message, 'Refreshing', 'The status channels are being updated.')
        }

        // No subcommand: show the current values + usage
        const values = await getValues(guild)
        const p = process.env.DISCORD_PREFIX
        return reply(
            message,
            'Server Status',
            `Members: ${values.members}\nServer Status: ${values.status}\nGame Code: ${values.code}\n\n` +
            `-# \`${p}status open\` · \`${p}status closed\` · \`${p}status code <code>\` · \`${p}status refresh\``
        )
    }
}
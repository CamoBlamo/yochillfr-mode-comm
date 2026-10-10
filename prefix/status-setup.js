const { Message, Client, ContainerBuilder, MessageFlags, TextDisplayBuilder, PermissionFlagsBits } = require('discord.js')
const { setupGuild } = require('../status/updater')
const { execute } = require('../commands/admin')

module.exports = {
    name: 'status-setup',
    description: 'creates the server status channels',

    /**
     * @param {Message} message
     * @param {String[]} args
     * @param {Client} client
     */
    async execute(message, args, client) {
        if (!message.inGuild()) return

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('You don\'t have permission to use this.')
        }

        const { category, created } = await setupGuild(message.guild)

        await message.reply({
            flags: [MessageFlags.IsComponentsV2],
            allowedMentions: { repliedUser: false },
            components: [
                new ContainerBuilder().addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        created
                            ? `**Status channels set up**\nCreated ${created} channel(s) in **${category.name}**.`
                            : `**Status channels already set up**\nEverything exists in **${category.name}**.`
                    )
                ),
            ],
        })
    }
}
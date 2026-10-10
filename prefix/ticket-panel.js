const { Message, Client, PermissionFlagsBits } = require('discord.js')
const { buildPanel } = require('../tickets/handler')

module.exports = {
    name: 'ticket-panel',
    description: 'posts the ticket panel in this channel',
    aliases: ['ticketpanel'],

    /**
     * @param {Message} message
     * @param {string[]} args
     * @param {Client} client
    */
    async execute(message, args, client) {
        if (!message.inGuild()) return

        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('You don\'t have permission to use this.')
        }

        await message.channel.send(buildPanel())
        await message.delete().catch(() => {})
    }
}
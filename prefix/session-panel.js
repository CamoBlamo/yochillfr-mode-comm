const { Message, Client } = require('discord.js')
const { postPanel } = require('../sessions/panel')
const { isManager } = require('../sessions/util')

module.exports = {
    name: 'session-panel',
    description: 'posts the session information panel in this channel',
    aliases: ['sessionpanel'],

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

        await postPanel(message.channel)
        await message.delete().catch(() => {})
    }
}
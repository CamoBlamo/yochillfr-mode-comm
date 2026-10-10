const { Message, Client } = require('discord.js')
const { isManager, getSessionChannel } = require('../sessions/util')
const { endSession } = require('../sessions/ssu')

module.exports = {
    name: 'ssd',
    description: 'ends the active session (server shut down)',
    aliases: ['shutdown', 'session-end'],

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

        const channel = await getSessionChannel(message.channel)

        const result = await endSession(channel, message.author.id)
        if (result.error) return message.reply(result.error)

        if (channel.id === message.channel.id) {
            await message.delete().catch(() => {})
        } else {
            await message.reply(`Session ended in ${channel}.`)
        }
    }
}
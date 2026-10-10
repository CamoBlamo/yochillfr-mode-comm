const { Message, Client } = require('discord.js')
const config = require('../sessions/config')
const { isManager, getSessionChannel } = require('../sessions/util')
const { startVote, cancelVote } = require('../sessions/vote')

module.exports = {
    name: 'session-vote',
    description: 'starts a session vote: session-vote [votes needed] | session-vote cancel',
    aliases: ['sessionvote', 'svote'],

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

        if ((args[0] || '').toLowerCase() === 'cancel') {
            const result = await cancelVote(client, message.author.id)
            if (result.error) return message.reply(result.error)
            return message.reply('Session vote cancelled.')
        }

        const required = Math.min(50, Math.max(1, parseInt(args[0], 10) || config.vote.requiredVotes))
        const channel = await getSessionChannel(message.channel)

        const result = await startVote(channel, message.author.id, required)
        if (result.error) return message.reply(result.error)

        if (channel.id === message.channel.id) {
            await message.delete().catch(() => {})
        } else {
            await message.reply(`Session vote started in ${channel}.`)
        }
    }
}
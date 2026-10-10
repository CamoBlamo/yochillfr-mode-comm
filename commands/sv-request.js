const { SlashCommandBuilder, InteractionContextType } = require('discord.js')
const { startRequest } = require('../sv/handler')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sv-request')
        .setDescription('Request a supervision')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await startRequest(interaction)
    },
}
const { SlashCommandBuilder, InteractionContextType } = require('discord.js')
const { startQA } = require('../qa/handler')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qa')
        .setDescription('Take the Trial Moderator Q/A')
        .setContexts(InteractionContextType.Guild),

    async execute(interaction) {
        await startQA(interaction)
    },
}
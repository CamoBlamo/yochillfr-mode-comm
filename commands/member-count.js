const {
    SlashCommandBuilder,
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
} = require('discord.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('member-count')
        .setDescription('Shows server statistics.'),

    async execute(interaction) {
        const guild = interaction.guild

        await guild.members.fetch()

        const totalMembers = guild.memberCount
        const boosts = guild.premiumSubscriptionCount || 0

        const onlineMembers = guild.members.cache.filter(member =>
            member.presence && member.presence.status !== 'offline'
        ).size

        await interaction.reply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent('## 📊 Server Statistics'),
                        new TextDisplayBuilder().setContent(
                            [
                                `👥 **Total Members:** \`${totalMembers}\``,
                                `🟢 **Online Members:** \`${onlineMembers}\``,
                                `🚀 **Server Boosts:** \`${boosts}\``
                            ].join('\n')
                        )
                    )
            ]
        })
    }
}
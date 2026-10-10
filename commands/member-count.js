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
                        new TextDisplayBuilder().setContent('## <:stats:1556986231991308340> Server Statistics'),
                        new TextDisplayBuilder().setContent(
                            [
                                `<:member:1556986201016115332> **Total Members:** \`${totalMembers}\``,
                                `🟢 **Online Members:** \`${onlineMembers}\``,
                                `<:boost:1556986151125131294> **Server Boosts:** \`${boosts}\``
                            ].join('\n')
                        )
                    )
            ]
        })
    }
}
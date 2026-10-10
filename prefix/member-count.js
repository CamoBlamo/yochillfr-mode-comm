const {
    ContainerBuilder,
    MessageFlags,
    TextDisplayBuilder,
} = require('discord.js')

module.exports = {
    name: 'server-info',
    description: 'View the server info',

    /**
     * @param {import("discord.js").Message} message
     * @param {string[]} args
     * @param {import("discord.js").Client} client
     */
    async execute(message, args, client) {
        const guild = message.guild

        await guild.members.fetch()

        const totalMembers = guild.memberCount
        const boosts = guild.premiumSubscriptionCount || 0

        const onlineMembers = guild.members.cache.filter(member =>
            member.presence && member.presence.status !== 'offline'
        ).size

        await message.reply({
            flags: [MessageFlags.IsComponentsV2],
            components: [
                new ContainerBuilder().addTextDisplayComponents(
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
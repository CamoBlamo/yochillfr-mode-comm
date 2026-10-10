const { SlashCommandBuilder, ContainerBuilder, MessageFlags, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } = require('discord.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('supervision-alert')
        .setDescription('alert active staff of a trial mod online'),

    async execute(interaction) {
        const supervisionAlertChannel = interaction.client.channels.cache.get('1551092409767567432');
        const ALLOWED_ROLES = ['1551443377487085648', '1551445904324567051', '1551903615092920381', '1540654715954790431']

        if (!interaction.member.roles.cache.hasAny(...ALLOWED_ROLES)) {
            return interaction.reply({ content: 'You don\'t have permission to use this.', flags: true })
        }

        const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('## Trial Mod Online')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('-# Ping: <@&1551445327830319165>')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('There is a on-duty Trial Moderator.\n\nPlease allow them to answer some calls.')
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )

        await supervisionAlertChannel.send({
            components: [container],
            flags: [MessageFlags.IsComponentsV2]
        })

        await interaction.reply({
            content: 'Sucess!',
            flags: [MessageFlags.Ephemeral]
        })
    }
}
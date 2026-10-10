const { SlashCommandBuilder, MessageFlags, ContainerBuilder, SeparatorBuilder, TextDisplayBuilder, SeparatorSpacingSize } = require('discord.js')
const { runCommand } = require('../utils/erlcApi')

const ALLOWED_ROLES = ['1551445904324567051', '1540655068049707139', '1540654715954790431']

const ROLE_COMMANDS = {
    helper: ':unhelper',
    mod: ':unmod',
    admin: ':unadmin',
}

const ROLE_NAMES = {
    helper: 'Helper',
    mod: 'Mod',
    admin: 'Admin',
}

function buildContainer(title, lines) {
    return new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`**${title}**`)
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            ...lines.map((line) => new TextDisplayBuilder().setContent(line))
        )
        .addSeparatorComponents(
            new SeparatorBuilder()
                .setDivider(true)
                .setSpacing(SeparatorSpacingSize.Large)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent('**FOOTER IMAGE COMING SOON**')
        )
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unadmin')
        .setDescription('set permissions of a user')
        .addStringOption(opt =>
            opt
                .setName('username')
                .setDescription('the username of the user')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt
                .setName('role')
                .setDescription('the role to remove from the user')
                .setRequired(true)
                .addChoices(
                    { name: 'Helper', value: 'helper' },
                    { name: 'Mod', value: 'mod' },
                    { name: 'Admin', value: 'admin' },
                )
        ),

    async execute(interaction) {
        if (!interaction.member.roles.cache.hasAny(...ALLOWED_ROLES)) {
            return interaction.reply({
                content: 'You are not allowed to execute this command.',
                flags: MessageFlags.Ephemeral
            })
        }

        const user = interaction.options.getString('username').trim()
        const role = interaction.options.getString('role')
        const roleName = ROLE_NAMES[role]

        // Roblox usernames are letters, numbers and underscores only.
        // Also stops anyone sneaking extra ERLC commands into the username.
        if (!/^[A-Za-z0-9_]{1,20}$/.test(user)) {
            return interaction.reply({
                content: 'That isn\'t a valid Roblox username.',
                flags: MessageFlags.Ephemeral
            })
        }

        // The ERLC API can take longer than Discord's 3 second reply window
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        try {
            await runCommand(`${ROLE_COMMANDS[role]} ${user}`)

            await interaction.editReply({
                components: [
                    buildContainer(`Successfully removed ${roleName} to ${user}`, [
                        `**User:** ${user}`,
                        `**Role:** ${roleName}`,
                        `**Actioned by:** ${interaction.user.tag}`,
                    ])
                ],
                flags: MessageFlags.IsComponentsV2
            })
        } catch (err) {
            console.error(`[admin] Failed to remove ${role} to ${user}:`, err.message)

            await interaction.editReply({
                components: [
                    buildContainer(`Failed to update the permissions of ${user}`, [
                        `**Error:** ${err.message}`,
                        'Check the username and try again. If the error continues, please contact <@1031195483923816501>.',
                    ])
                ],
                flags: MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] }
            })
        }
    }
}
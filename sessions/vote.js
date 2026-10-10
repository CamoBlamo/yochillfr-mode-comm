const {
    MessageFlags,
    ContainerBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} = require('discord.js')
const config = require('./config')
const store = require('./store')
const { text, separator, unix, image, bulletList, imagesFor } = require('./util')
const { updatePanel } = require('./panel')

const MAX_SHOWN_VOTERS = 40

// ---------- Message ----------

function progressBar(count, required) {
    const filled = Math.min(10, Math.round((count / required) * 10))
    const percent = Math.min(100, Math.round((count / required) * 100))
    return `${'▰'.repeat(filled)}${'▱'.repeat(10 - filled)} ${percent}%`
}

// state: 'open' | 'cancelled' | 'started'
function buildVoteMessage(vote, state = 'open', byUserId = null) {
    const v = config.vote
    const { banner, footer } = imagesFor(v)
    const count = vote.voters.length
    const pingRole = config.SESSION_PING_ROLE_ID

    const container = new ContainerBuilder()
    if (banner) container.addMediaGalleryComponents(image(banner))

    container
        .addTextDisplayComponents(
            text(`## ${v.titleEmoji ? `${v.titleEmoji} ` : ''}${v.title}`),
            text(`> ${v.description}`)
        )
        .addSeparatorComponents(separator())
        .addTextDisplayComponents(
            text(
                '### Vote Information\n' +
                bulletList([
                    ['Host', `<@${vote.hostId}>`, true],
                    ['Votes', `${count}/${vote.required}`],
                    ['Started', `<t:${unix(vote.startedAt)}:R>`, true],
                ]) +
                `\n${progressBar(count, vote.required)}`
            )
        )
        .addSeparatorComponents(separator())

    const shown = vote.voters.slice(0, MAX_SHOWN_VOTERS).map((id) => `<@${id}>`).join(', ')
    const extra = count > MAX_SHOWN_VOTERS ? ` and **${count - MAX_SHOWN_VOTERS}** more` : ''
    container.addTextDisplayComponents(
        text(`### Voters\n${count ? shown + extra : '-# No votes yet. Be the first!'}`)
    )

    const statusLine = {
        cancelled: `❌ **Vote cancelled**${byUserId ? ` by <@${byUserId}>` : ''}.`,
        started: `🟢 **Session started**${byUserId ? ` by <@${byUserId}>` : ''}! Thanks for voting.`,
        open: vote.reached ? '✅ **Vote goal reached!** The host will start the session shortly.' : null,
    }[state]

    if (statusLine) {
        container
            .addSeparatorComponents(separator())
            .addTextDisplayComponents(text(statusLine))
    }

    const open = state === 'open'

    container
        .addSeparatorComponents(separator())
        .addActionRowComponents(
            new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('session:vote')
                    .setLabel(`Vote (${count})`)
                    .setEmoji(v.voteEmoji)
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(!open),
                new ButtonBuilder()
                    .setCustomId('session:voters')
                    .setLabel('View Voters')
                    .setEmoji('👥')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(!open)
            )
        )

    if (pingRole && open) container.addTextDisplayComponents(text(`-# <@&${pingRole}>`))
    if (footer) container.addMediaGalleryComponents(image(footer))

    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

// Edit a finished vote's message (cancelled / started). Never throws.
async function finishVoteMessage(client, vote, state, byUserId) {
    const channel = await client.channels.fetch(vote.channelId).catch(() => null)
    const message = channel && await channel.messages.fetch(vote.messageId).catch(() => null)
    if (!message) return

    await message.edit({ ...buildVoteMessage(vote, state, byUserId), allowedMentions: { parse: [] } }).catch((err) =>
        console.error(`[Sessions] Failed to mark vote ${state}:`, err.message)
    )
}

// ---------- Start / cancel ----------

async function startVote(channel, hostId, required) {
    const data = store.load()

    if (data.session.active) return { error: 'A session is already active.' }
    if (data.vote) {
        const link = `https://discord.com/channels/${channel.guild.id}/${data.vote.channelId}/${data.vote.messageId}`
        return { error: `A session vote is already running: ${link}` }
    }

    const vote = {
        channelId: channel.id,
        messageId: null,
        hostId,
        required,
        voters: [],
        startedAt: Date.now(),
        reached: false,
    }

    const message = await channel.send({
        ...buildVoteMessage(vote),
        allowedMentions: { roles: config.SESSION_PING_ROLE_ID ? [config.SESSION_PING_ROLE_ID] : [] },
    })

    vote.messageId = message.id
    data.vote = vote
    store.save(data)

    updatePanel(channel.client)
    return { message }
}

async function cancelVote(client, cancelledBy) {
    const data = store.load()
    const vote = data.vote
    if (!vote) return { error: 'There is no session vote running.' }

    data.vote = null
    store.save(data)

    await finishVoteMessage(client, vote, 'cancelled', cancelledBy)

    updatePanel(client)
    return { vote }
}

// ---------- Buttons ----------

async function handleVote(interaction) {
    const data = store.load()
    const vote = data.vote

    if (!vote || vote.messageId !== interaction.message.id) {
        return interaction.reply({ content: 'This session vote has ended.', flags: MessageFlags.Ephemeral })
    }

    const userId = interaction.user.id
    const index = vote.voters.indexOf(userId)
    const removing = index !== -1

    if (removing) vote.voters.splice(index, 1)
    else vote.voters.push(userId)

    const reachedNow = !vote.reached && vote.voters.length >= vote.required
    if (reachedNow) vote.reached = true

    store.save(data)

    await interaction.update({ ...buildVoteMessage(vote), allowedMentions: { parse: [] } })

    await interaction.followUp({
        content: removing ? 'Your vote was removed.' : '✅ Your vote was counted. Click again to remove it.',
        flags: MessageFlags.Ephemeral,
    })

    if (reachedNow) {
        await interaction.channel.send({
            content: `<@${vote.hostId}>, the session vote reached **${vote.required}** votes. You can start the session now.`,
            allowedMentions: { users: [vote.hostId] },
        }).catch(() => {})
    }
}

async function handleVoters(interaction) {
    const { vote } = store.load()

    if (!vote || vote.messageId !== interaction.message.id) {
        return interaction.reply({ content: 'This session vote has ended.', flags: MessageFlags.Ephemeral })
    }

    const list = vote.voters.map((id, i) => `${i + 1}. <@${id}>`).join('\n')

    await interaction.reply({
        content: vote.voters.length
            ? `**Voters (${vote.voters.length}/${vote.required})**\n${list}`.slice(0, 2000)
            : 'No one has voted yet.',
        flags: MessageFlags.Ephemeral,
        allowedMentions: { parse: [] },
    })
}

module.exports = { startVote, cancelVote, finishVoteMessage, handleVote, handleVoters, buildVoteMessage }
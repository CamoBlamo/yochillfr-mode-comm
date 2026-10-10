const {
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    PermissionFlagsBits,
} = require('discord.js')
const config = require('./config')

const text = (content) => new TextDisplayBuilder().setContent(content)
const separator = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
const unix = (ms = Date.now()) => Math.floor(ms / 1000)
const code = (v) => `\`${String(v ?? 'N/A').replace(/`/g, 'ˋ')}\``
const image = (url) => new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(url))

// "• Label: value" lines. raw = true leaves the value as-is (for mentions/timestamps)
function bulletList(lines) {
    return lines
        .map(([label, value, raw]) => `${config.bullet} ${label}: ${raw ? value : code(value)}`)
        .join('\n')
}

function isManager(member) {
    if (config.MANAGER_ROLE_IDS.length) return member.roles.cache.hasAny(...config.MANAGER_ROLE_IDS)
    return member.permissions.has(PermissionFlagsBits.Administrator)
}

// Banner/footer for a section, falling back to the shared images
function imagesFor(section = {}) {
    return {
        banner: section.bannerUrl || config.images.bannerUrl,
        footer: section.footerImageUrl || config.images.footerImageUrl,
    }
}

async function getSessionChannel(fallback) {
    if (!config.SESSION_CHANNEL_ID) return fallback
    return fallback.client.channels.fetch(config.SESSION_CHANNEL_ID).catch(() => fallback)
}

module.exports = { text, separator, unix, code, image, bulletList, isManager, imagesFor, getSessionChannel }
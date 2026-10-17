module.exports = {
    CATEGORY_NAME: 'Server Status⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯',

    GAME_CODE: 'MfVBv',

    INVITE: 'discord.gg/cs1rp',

    UPDATE_INTERVAL_MINUTES: 10,

    MANAGER_ROLE_IDS: [],

    statusText: {
        open: 'Open 🟢',
        closed: 'Closed 🔴',
    },

    channels: [
        { key: 'members', template: 'Members: {members}' },
        { key: 'status', template: 'Server Status: {status}' },
        { key: 'code', template: 'Game Code: MfVBv' },
        { key: 'invite', template: '{invite}' },
    ],
}
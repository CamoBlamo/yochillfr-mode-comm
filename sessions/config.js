module.exports = {
    MANAGER_ROLE_IDS: [],

    SESSION_PING_ROLE_ID: '1556906491934674944',

    SESSION_CHANNEL_ID: '1532951776213602384',

    UPDATE_INTERVAL_SECONDS: 60,

    SYNC_STATUS_CHANNELS: true,

    images: {
        bannerUrl: 'https://yumi.onl/api/files/6ac736583011a69b49e60220/raw', // top image
        footerImageUrl: 'https://yumi.onl/api/files/6ac700f0b11d4c7edb0df0b6/raw', // bottom image
    },

    bullet: '•',

    panel: {
        title: 'Colorado State Roleplay Sessions',
        titleEmoji: '🌐',
        description: 'Welcome to our session panel. Here you can view our live ERLC status, server information & more. Sessions are hosted whenever a staff member is available, so please refrain from pinging staff to ask for one.',
        bannerUrl: 'https://yumi.onl/api/files/6ac736583011a69b49e60220/raw',
        footerImageUrl: 'https://yumi.onl/api/files/6ac700f0b11d4c7edb0df0b6/raw',
        notifyEmoji: '🔔',
        quickJoinEmoji: '',
    },

    vote: {
        requiredVotes: 15,
        title: 'Session Vote',
        titleEmoji: '🗳️',
        description: 'A session vote has been started! If you\'re able to attend, press **Vote** below. Once enough votes are reached, the host will start the session. Only vote if you will join.',
        voteEmoji: '🗳️',
        bannerUrl: 'https://yumi.onl/api/files/6ac736583011a69b49e60220/raw',
        footerImageUrl: 'https://yumi.onl/api/files/6ac700f0b11d4c7edb0df0b6/raw',
    },

    // {code} is replaced with the server join code
    QUICK_JOIN_URL: 'https://erlc.gg/join/{code}',

    // Placeholder server data until the ER:LC API is hooked up (see sessions/erlc.js)
    server: {
        owner: 'Braydensuvin',
        name: 'Colorado State Roleplay',
        joinCode: 'yVHYq',
        maxPlayers: 50,
    },

    ssu: {
        title: 'Server Start Up',
        titleEmoji: '🟢',
        description: 'A session has started! Join using the information below. Make sure to follow all server rules and have fun. If you voted, you are expected to join.',
        pingVoters: true, // mention everyone who voted on the session vote
        bannerUrl: '', // overrides images.bannerUrl for startups only
        footerImageUrl: '',
    },

    ssd: {
        title: 'Server Shut Down',
        titleEmoji: '🔴',
        description: 'The session has ended. Thank you to everyone who attended! Keep an eye on session notifications for the next one.',
        pingRole: false, // ping the session role on shutdown
        bannerUrl: '', // overrides images.bannerUrl for shutdowns only
        footerImageUrl: '',
    },
}
module.exports = {
    REQUESTER_ROLE_IDS: ['1556877601371455591'],

    REVIEWER_ROLE_IDS: ['1551443377487085648', '1532971092195545260', '1551445904324567051', '1540655068049707139', '1540654715954790431'],

    REQUEST_CHANNEL_ID: '1552525508976058519',

    PING_ROLE_IDS: [],

    APPROVE_ADD_ROLE_ID: '',
    APPROVE_REMOVE_ROLE_ID: '',

    DENY_COOLDOWN_MINUTES: 30,

    images: {
        bannerUrl: '',
        footerImageUrl: 'https://yumi.onl/api/files/6ac700f0b11d4c7edb0df0b6/raw',
    },

    bullet: '•',

    text: {
        title: 'Supervision Request',
        titleEmoji: '📋',
        description: 'A trial moderator is requesting a supervision. Review the details below.',
        formTitle: 'SV Request',
        submitted: 'Your SV request has been sent. You\'ll get a DM when it\'s reviewed.',
        approvedDm: 'Your supervision request was **approved**. A supervisor will reach out to you.',
        deniedDm: 'Your supervision request was **denied**.',
    },

    questions: [
        { label: 'Roblox Username', placeholder: 'e.g. Builderman', style: 'short', required: true, maxLength: 50 },
        { label: 'Availability', description: 'When are you available for a supervision?', style: 'short', required: true, maxLength: 200 },
        { label: 'Notes', description: 'Anything the supervisor should know.', style: 'paragraph', required: false, maxLength: 500 },
    ],
}
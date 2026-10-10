module.exports = {
    CLAIM_ROLE_IDS: ['1532971092195545260', '1551445904324567051', '1551903615092920381', '1540655068049707139'],

    TRANSCRIPT_CHANNEL_ID: '1551093169934966804',

    CLOSE_DELAY_MS: 5000,

    DM_ON_CLOSE: true,

    branding: {
        bannerUrl: 'https://yumi.onl/api/files/6ac4802fcf827aa766543f1b/raw',
        footer: '',
        footerImageUrl: 'https://yumi.onl/api/files/6ac700f0b11d4c7edb0df0b6/raw',
    },

    panel: {
        title: 'Contact Us',
        description: 'Need assistance? Open a ticket and our team will be ready to help. Choose the category that matches your issue below and a private channel will be opened for you.',
        placeholder: 'Choose your category',
    },

    categories: {
        general: {
            label: 'General Support',
            description: 'Questions, support, and assistance from any staff member.',
            emoji: '🛠️',
            channelPrefix: 'general',
            parentId: '',
            roleIds: ['1532971092195545260', '1551445904324567051', '1540655068049707139', '1540654715954790431'],
            questions: [
                { label: 'Reason for opening', description: 'What do you need help with?', style: 'paragraph', required: true, minLength: 10, maxLength: 1000 },
                { label: 'Additional details', description: 'Anything else staff should know. Links, screenshots, timestamps.', style: 'paragraph', required: false, maxLength: 1000 },
            ],
        },
        highrank: {
            label: 'High Rank Support',
            description: 'Escalated concerns requiring senior staff attention.',
            emoji: '🛡️',
            channelPrefix: 'highrank',
            parentId: '',
            roleIds: ['1540654715954790431', '1540655068049707139'],
            questions: [
                { label: 'Reason for opening', description: 'Explain your concern in detail.', style: 'paragraph', required: true, minLength: 20, maxLength: 1000 },
                { label: 'Additional details', description: 'Anything else staff should know. Links, screenshots, timestamps.', style: 'paragraph', required: false, maxLength: 1000 },
            ],
        },
    },
}
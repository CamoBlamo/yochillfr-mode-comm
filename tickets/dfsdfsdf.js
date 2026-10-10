module.exports = {
    //IA_ROLE_ID: '1532971092195545260',

    CLAIM_ROLE_IDS: ['1532971092195545260', '1551445904324567051', '1551903615092920381', '1540655068049707139'],

    TRANSCRIPT_CHANNEL_ID: '1551093169934966804',

    CLOSE_DELAY_MS: 5000,

    panel: {
        bannerUrl: 'https://yumi.onl/api/files/6ac4802fcf827aa766543f1b/raw',
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
            roleIds: [], 
        },
        highrank: {
            label: 'High Rank Support',
            description: 'Escalated concerns requiring senior staff attention.',
            emoji: '🛡️',
            channelPrefix: 'highrank',
            parentId: '',
            roleIds: [],
        },
    },
}
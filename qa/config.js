module.exports = {
    // Only members with this role can take the Q/A
    TRIAL_MOD_ROLE_ID: '1556877601371455591',

    // Role given when a submission is approved
    READY_SV_ROLE_ID: '1556878263920623626',

    // Where submissions get sent for review
    ADMIN_CHANNEL_ID: '1552525508976058519',

    // Roles allowed to approve/deny. Leave empty = anyone with Manage Roles.
    REVIEWER_ROLE_IDS: ['1551443377487085648', '1532971092195545260', '1551445904324567051', '1540655068049707139', '1540654715954790431'],

    // Hours before they can retake after a deny. 0 = no cooldown.
    COOLDOWN_HOURS: 1,

    // DM the trial mod when they're approved/denied
    DM_RESULTS: true,

    // How long they have to finish all pages before the session expires
    SESSION_MINUTES: 30,

    // Max characters per answer (auto-lowered if there are a lot of questions,
    // so the whole submission fits in one Discord message)
    MAX_ANSWER_LENGTH: 500,

    // label: short title shown above the box (max 45 chars)
    // question: the full question shown under the label (max 100 chars)
    // minLength: optional minimum answer length
    // Every 5 questions = 1 page; extra pages open with a "Continue" button.
    questions: [
        { label: 'Question 1', question: 'Placeholder', minLength: 10 },
        { label: 'Question 2', question: 'Placeholder', minLength: 10 },
        { label: 'Question 3', question: 'Placeholder', minLength: 10 },
        { label: 'Question 4', question: 'Placeholder', minLength: 10 },
        { label: 'Question 5', question: 'Placeholder', minLength: 10 },
    ],
}
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
        { label: 'Question 1', question: 'What punishment should a player receive for committing FRP (Fail Roleplay)?', minLength: 10 },
        { label: 'Question 2', question: 'What is the difference between RDM and VDM, and how should each offence be handled?', minLength: 10 },
        { label: 'Question 3', question: 'A player is caught cuff rushing another player. What action should you take?', minLength: 10 },
        { label: 'Question 4', question: 'A player robs the bank without the required permissions. What rule have they broken, and what punishment should they receive?', minLength: 10 },
        { label: 'Question 5', question: 'How many warnings can a player receive within one hour before being kicked?', minLength: 10 },
        { label: 'Question 6', question: 'What should you do if a player repeatedly cop baits officers?', minLength: 10 },
        { label: 'Question 7', question: 'A player is driving around with a smoking engine. What rule are they breaking?', minLength: 10 },
        { label: 'Question 8', question: 'What punishment should someone receive for impersonating a staff member?', minLength: 10 },
        { label: 'Question 9', question: 'A player refuses to cooperate during a staff situation and keeps running away. How would you handle this?', minLength: 10 },
        { label: 'Question 10', question: 'What should you do if a player is caught interfering with an ongoing roleplay?', minLength: 10 },
        { label: 'Question 11', question: 'A law enforcement officer repeatedly breaks traffic laws without a valid roleplay reason. What action should you take?', minLength: 10 },
        { label: 'Question 12', question: 'What punishment should a player receive for using racial slurs?', minLength: 10 },
        { label: 'Question 13', question: 'A player abuses the !mod command by repeatedly making false reports. How should you respond?', minLength: 10 },
        { label: 'Question 14', question: 'What should you do if a player commits Mass RDM?', minLength: 10 },
        { label: 'Question 15', question: 'A player disrespects staff and continues trolling after being warned. What steps should you take?', minLength: 10 },
    ],
}
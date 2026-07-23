const VALID_TRANSITIONS = {
    INITIATED: ['PENDING', 'FAILED'],
    PENDING: ['PROCESSING', 'FAILED'],
    PROCESSING: ['SUCCESS', 'FAILED'],
    SUCCESS: ['REVERSED'],
    FAILED: [],
    REVERSED: [],
};

const transition = (current, next) => {
    const allowed = VALID_TRANSITIONS[current];
    if (!allowed) throw new Error(`Unknown state: ${current}`);
    if (!allowed.includes(next)) {
        throw new Error(`Invalid transition: ${current} → ${next}`);
    }
    return next;
};

const canTransition = (current, next) => {
    const allowed = VALID_TRANSITIONS[current];
    return Boolean(allowed && allowed.includes(next));
};

const updateTxStatus = async (dbClient, txId, currentStatus, nextStatus, failureReason = null) => {
    transition(currentStatus, nextStatus);
    await dbClient.query(
        `UPDATE transactions 
         SET status = $1, failure_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [nextStatus, failureReason, txId]
    );
};

module.exports = { transition, canTransition, updateTxStatus, VALID_TRANSITIONS };
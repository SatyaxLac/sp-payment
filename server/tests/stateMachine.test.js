const { describe, it } = require('node:test');
const assert = require('node:assert');
const { transition, canTransition, VALID_TRANSITIONS } = require('../src/utils/stateMachine');

describe('Transaction State Machine Tests', () => {
    it('allows valid state transitions', () => {
        assert.strictEqual(transition('INITIATED', 'PENDING'), 'PENDING');
        assert.strictEqual(transition('INITIATED', 'FAILED'), 'FAILED');
        assert.strictEqual(transition('PENDING', 'PROCESSING'), 'PROCESSING');
        assert.strictEqual(transition('PENDING', 'FAILED'), 'FAILED');
        assert.strictEqual(transition('PROCESSING', 'SUCCESS'), 'SUCCESS');
        assert.strictEqual(transition('PROCESSING', 'FAILED'), 'FAILED');
        assert.strictEqual(transition('SUCCESS', 'REVERSED'), 'REVERSED');
    });

    it('rejects invalid state transitions', () => {
        assert.throws(() => transition('INITIATED', 'REVERSED'), /Invalid transition/);
        assert.throws(() => transition('INITIATED', 'SUCCESS'), /Invalid transition/);
        assert.throws(() => transition('FAILED', 'SUCCESS'), /Invalid transition/);
        assert.throws(() => transition('REVERSED', 'INITIATED'), /Invalid transition/);
    });

    it('handles unknown states gracefully', () => {
        assert.throws(() => transition('UNKNOWN_STATE', 'SUCCESS'), /Unknown state/);
    });

    it('correctly reports transition capability with canTransition', () => {
        assert.strictEqual(canTransition('INITIATED', 'PENDING'), true);
        assert.strictEqual(canTransition('INITIATED', 'SUCCESS'), false);
        assert.strictEqual(canTransition('FAILED', 'PENDING'), false);
        assert.strictEqual(canTransition('UNKNOWN', 'PENDING'), false);
    });

    it('ensures terminal states have no outbound transitions', () => {
        assert.deepStrictEqual(VALID_TRANSITIONS['FAILED'], []);
        assert.deepStrictEqual(VALID_TRANSITIONS['REVERSED'], []);
    });
});

'use strict';

/**
 * Stage D: hand off to the existing fleet reviewer.
 * Does not post a review, approve, or merge.
 */

function prepareReview({ implementation } = {}) {
  if (!implementation || implementation.status !== 'ready') {
    return {
      status: 'refused',
      reason: 'no-implementation',
      identity: 'noemi-reviewer-bot',
    };
  }
  if (implementation.opened !== true || !implementation.url) {
    return {
      status: 'waiting',
      reason: 'pr-not-opened',
      identity: 'noemi-reviewer-bot',
      label: 'noemi:in-progress',
    };
  }
  return {
    status: 'delegated',
    reason: 'fleet-reviewer',
    identity: 'noemi-reviewer-bot',
    label: 'noemi:review',
    pr: implementation.url,
  };
}

module.exports = { prepareReview };

'use strict';

/**
 * Shared HTTP error helpers for model calls. Classification keys on the
 * structured `status` property, never on message text (Decision [2026-08-17-0003]).
 */

function isTransientHttpError(err) {
  if (err && Number.isInteger(err.status)) {
    return err.status === 429 || (err.status >= 500 && err.status < 600);
  }
  return Boolean(err) && err.name === 'TypeError';
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function modelRetryOptions() {
  return {
    maxRetries: 4,
    baseDelayMs: Number(process.env.MODEL_RETRY_BASE_MS || process.env.GITHUB_RETRY_BASE_MS || 2000),
    maxDelayMs: 20000,
    retryIf: isTransientHttpError,
  };
}

module.exports = { httpError, isTransientHttpError, modelRetryOptions };

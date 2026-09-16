'use strict';

const assert = require('assert');
const test = require('node:test');

const {
  isFallbackError,
  runWithFallbacks,
} = require('./fallback.js');

function errorWithStatus(status) {
  const err = new Error(`HTTP ${status}`);
  err.status = status;
  return err;
}

test('429 is a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(429)),
    true,
  );
});

test('500 is a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(500)),
    true,
  );
});

test('502 is a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(502)),
    true,
  );
});

test('503 is a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(503)),
    true,
  );
});

test('599 is a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(599)),
    true,
  );
});

test('network TypeError is a fallback-worthy error', () => {
  const err = new TypeError('fetch failed');

  assert.strictEqual(
    isFallbackError(err),
    true,
  );
});

test('400 is not a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(400)),
    false,
  );
});

test('401 is not a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(401)),
    false,
  );
});

test('403 is not a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(403)),
    false,
  );
});

test('404 is not a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(404)),
    false,
  );
});

test('422 is not a fallback-worthy error', () => {
  assert.strictEqual(
    isFallbackError(errorWithStatus(422)),
    false,
  );
});

test('generic errors are not fallback-worthy', () => {
  assert.strictEqual(
    isFallbackError(new Error('invalid plan')),
    false,
  );
});

test('preferred provider is used when it succeeds', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['grok', 'mock'],
    providers: {
      gemini: async (input) => {
        calls.push(['gemini', input]);
        return 'gemini-result';
      },
      grok: async () => {
        calls.push(['grok']);
        return 'grok-result';
      },
      mock: async () => {
        calls.push(['mock']);
        return 'mock-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'gemini-result');

  assert.deepStrictEqual(calls, [
    ['gemini', { prompt: 'test' }],
  ]);
});

test('429 causes fallback to the next provider', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['grok'],
    providers: {
      gemini: async () => {
        calls.push('gemini');
        throw errorWithStatus(429);
      },
      grok: async (input) => {
        calls.push(['grok', input]);
        return 'grok-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'grok-result');

  assert.deepStrictEqual(calls, [
    'gemini',
    ['grok', { prompt: 'test' }],
  ]);
});

test('5xx causes fallback to the next provider', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['mock'],
    providers: {
      gemini: async () => {
        calls.push('gemini');
        throw errorWithStatus(503);
      },
      mock: async () => {
        calls.push('mock');
        return 'mock-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'mock-result');

  assert.deepStrictEqual(calls, [
    'gemini',
    'mock',
  ]);
});

test('network TypeError causes fallback', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['mock'],
    providers: {
      gemini: async () => {
        calls.push('gemini');
        throw new TypeError('fetch failed');
      },
      mock: async () => {
        calls.push('mock');
        return 'mock-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'mock-result');

  assert.deepStrictEqual(calls, [
    'gemini',
    'mock',
  ]);
});

test('non-transient errors do not trigger fallback', async () => {
  const calls = [];

  await assert.rejects(
    () => runWithFallbacks({
      preferred: 'gemini',
      fallbacks: ['grok'],
      providers: {
        gemini: async () => {
          calls.push('gemini');
          throw errorWithStatus(401);
        },
        grok: async () => {
          calls.push('grok');
          return 'grok-result';
        },
      },
      input: { prompt: 'test' },
    }),
    (err) => err.status === 401,
  );

  assert.deepStrictEqual(calls, [
    'gemini',
  ]);
});

test('skips providers that are not configured', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['grok', 'mock'],
    providers: {
      gemini: null,
      grok: undefined,
      mock: async () => {
        calls.push('mock');
        return 'mock-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'mock-result');
  assert.deepStrictEqual(calls, ['mock']);
});

test('tries fallbacks in configured order', async () => {
  const calls = [];

  const result = await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['grok', 'mock'],
    providers: {
      gemini: async () => {
        calls.push('gemini');
        throw errorWithStatus(503);
      },
      grok: async () => {
        calls.push('grok');
        throw errorWithStatus(429);
      },
      mock: async () => {
        calls.push('mock');
        return 'mock-result';
      },
    },
    input: { prompt: 'test' },
  });

  assert.strictEqual(result, 'mock-result');

  assert.deepStrictEqual(calls, [
    'gemini',
    'grok',
    'mock',
  ]);
});

test('throws the last fallback error when every provider fails', async () => {
  const calls = [];

  await assert.rejects(
    () => runWithFallbacks({
      preferred: 'gemini',
      fallbacks: ['grok'],
      providers: {
        gemini: async () => {
          calls.push('gemini');
          throw errorWithStatus(503);
        },
        grok: async () => {
          calls.push('grok');
          throw errorWithStatus(429);
        },
      },
      input: { prompt: 'test' },
    }),
    (err) => err.status === 429,
  );

  assert.deepStrictEqual(calls, [
    'gemini',
    'grok',
  ]);
});

test('throws when no providers are available', async () => {
  await assert.rejects(
    () => runWithFallbacks({
      preferred: 'gemini',
      fallbacks: ['grok'],
      providers: {},
      input: { prompt: 'test' },
    }),
    /No available providers/,
  );
});
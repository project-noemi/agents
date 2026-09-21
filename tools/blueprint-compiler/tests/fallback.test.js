import assert from 'node:assert/strict';
import test from 'node:test';
import { isFallbackError, runWithFallbacks } from '../src/providers/fallback.js';

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

test('TimeoutError (AbortSignal.timeout) is a fallback-worthy error', () => {
  assert.strictEqual(isFallbackError(new DOMException('timed out', 'TimeoutError')), true);
});

test('status boundaries: 499 and 600 are not fallback-worthy', () => {
  assert.strictEqual(isFallbackError(errorWithStatus(499)), false);
  assert.strictEqual(isFallbackError(errorWithStatus(600)), false);
});

test('a PROVIDER_CONFIG error is not fallback-worthy (fail closed)', () => {
  const err = new Error('AI_GW_API_KEY is not set');
  err.code = 'PROVIDER_CONFIG';
  assert.strictEqual(isFallbackError(err), false);
});

test('a missing-key error stops the chain instead of falling through', async () => {
  const calls = [];
  const cfg = Object.assign(new Error('no key'), { code: 'PROVIDER_CONFIG' });
  await assert.rejects(
    () => runWithFallbacks({
      preferred: 'gemini',
      fallbacks: ['mock'],
      providers: {
        gemini: async () => { calls.push('gemini'); throw cfg; },
        mock: async () => { calls.push('mock'); return 'mock-result'; },
      },
      input: {},
    }),
    (err) => err.code === 'PROVIDER_CONFIG',
  );
  assert.deepStrictEqual(calls, ['gemini']);
});

test('onFallback reports each provider that failed, in order', async () => {
  const seen = [];
  await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['grok', 'mock'],
    providers: {
      gemini: async () => { throw errorWithStatus(503); },
      grok: async () => { throw new DOMException('t', 'TimeoutError'); },
      mock: async () => 'mock-result',
    },
    input: {},
    onFallback: ({ provider, error }) => seen.push([provider, error.status ?? error.name]),
  });
  assert.deepStrictEqual(seen, [['gemini', 503], ['grok', 'TimeoutError']]);
});

test('onFallback is not called when the preferred provider succeeds', async () => {
  let called = false;
  await runWithFallbacks({
    preferred: 'gemini',
    fallbacks: ['mock'],
    providers: { gemini: async () => 'ok', mock: async () => 'mock' },
    input: {},
    onFallback: () => { called = true; },
  });
  assert.strictEqual(called, false);
});

test('"no providers" error carries code PROVIDER', async () => {
  await assert.rejects(
    () => runWithFallbacks({ preferred: 'gemini', fallbacks: [], providers: {}, input: {} }),
    (err) => err.code === 'PROVIDER',
  );
});

test('a TypeError that is a code bug is NOT fallback-worthy', () => {
  const bug = new TypeError("Cannot read properties of undefined (reading 'Role')");
  assert.strictEqual(isFallbackError(bug), false);
});

test('an invalid-URL TypeError is NOT fallback-worthy', () => {
  assert.strictEqual(isFallbackError(new TypeError('Failed to parse URL from not a url')), false);
});

test('a code-bug TypeError stops the chain instead of hiding behind mock', async () => {
  const calls = [];
  await assert.rejects(
    () => runWithFallbacks({
      preferred: 'gemini',
      fallbacks: ['mock'],
      providers: {
        gemini: async () => { calls.push('gemini'); return undefined.sections; },
        mock: async () => { calls.push('mock'); return 'mock-result'; },
      },
      input: {},
    }),
    (err) => err instanceof TypeError,
  );
  assert.deepStrictEqual(calls, ['gemini']);
});
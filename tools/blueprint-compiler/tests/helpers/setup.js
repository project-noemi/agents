// Loaded via `node --import` before every test file (see package.json).
// Real backoff is 1s, 2s, 4s; tests keep the retry count but not the waiting.
// A test that needs other values sets them with withEnv().
process.env.AI_GW_RETRY_BASE_MS ??= "0";

/**
 * Pure cost maths. The price table comes from config.js (loadPriceTable); this
 * module never reads the environment.
 *
 * Prices are USD per million tokens, so a run costs
 *   inputTokens * inputPerMTok / 1e6 + outputTokens * outputPerMTok / 1e6.
 */
import { modelKey } from "./config.js";

const count = (n) => (Number.isFinite(n) && n > 0 ? n : 0);

/**
 * Cost of one answer, or null when the model has no entry in the table.
 * Null is not zero: an unpriced model must never look free.
 *
 * @param {{ model?: string, inputTokens?: number, outputTokens?: number }} usage
 * @param {Map<string, { inputPerMTok: number, outputPerMTok: number }>} prices
 * @returns {number | null}
 */
export function costUsd({ model, inputTokens, outputTokens } = {}, prices) {
  const price = model ? prices.get(modelKey(model)) : undefined;
  if (!price) return null;
  const usd =
    (count(inputTokens) * price.inputPerMTok + count(outputTokens) * price.outputPerMTok) / 1e6;
  // Ten decimals keeps float noise out of stored totals without losing sub-cent runs.
  return Math.round(usd * 1e10) / 1e10;
}

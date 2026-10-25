/**
 * Shared incremental-response helpers for provider adapters.
 *
 * The caller owns fallback policy. A provider must call onToken only after
 * receiving validated text from the upstream stream; once called, fallback
 * must stop and the run must surface any later failure.
 */
export function emitText(onToken, text) {
  if (typeof text !== "string" || text.length === 0) return;
  onToken?.(text);
}

/** Parse OpenAI-compatible SSE data records from a WHATWG ReadableStream. */
export async function* readSse(response) {
  if (!response.body) throw new Error("Provider returned no response stream.");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        for (const line of block.split(/\r?\n/)) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trimStart();
          if (!data || data === "[DONE]") continue;
          yield JSON.parse(data);
        }
      }
    }
    if (buffer.trim()) {
      for (const line of buffer.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trimStart();
        if (data && data !== "[DONE]") yield JSON.parse(data);
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Read Gemini's native SSE stream and extract candidate text deltas. */
export async function* readGeminiSse(response, onUsage) {
  for await (const data of readSse(response)) {
    if (data.usageMetadata) onUsage?.(data.usageMetadata);
    const candidate = data.candidates?.[0];
    const reason = candidate?.finishReason;
    if (data.promptFeedback?.blockReason) {
      const err = new Error("Gemini blocked the prompt.");
      err.code = "PROVIDER_EMPTY";
      throw err;
    }
    if (candidate && reason && !["STOP", "MAX_TOKENS", "FINISH_REASON_UNSPECIFIED"].includes(reason)) {
      const err = new Error(`Gemini stopped with finishReason ${reason}.`);
      err.code = "PROVIDER_EMPTY";
      throw err;
    }
    const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
    if (text) yield text;
  }
}

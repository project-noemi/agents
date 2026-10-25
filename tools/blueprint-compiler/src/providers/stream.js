/**
 * Small SSE reader shared by the live provider adapters.
 * Callbacks receive text deltas only; usage is returned by the provider's
 * final event. This module never reads credentials from the browser.
 */
export async function readSse(response, onText, parseEvent) {
  if (!response.body) {
    const err = new Error("Provider returned no response stream.");
    err.code = "PROVIDER_STREAM";
    throw err;
  }
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let boundary;
      while ((boundary = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const data = block.split("\n").filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart()).join("\n");
        if (!data || data === "[DONE]") continue;
        let event;
        try { event = JSON.parse(data); } catch {
          const err = new Error("Provider returned malformed stream data.");
          err.code = "PROVIDER_STREAM";
          throw err;
        }
        const delta = parseEvent(event);
        if (delta?.text) onText?.(delta.text);
        if (delta?.usage) return delta.usage;
      }
    }
  } finally {
    reader.releaseLock();
  }
  return undefined;
}

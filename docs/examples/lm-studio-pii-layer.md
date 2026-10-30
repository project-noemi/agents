# Build a Local PII Security Layer with LM Studio

> **Status:** First version. Items marked `TODO` still need data from a real run.
> **Track:** Sovereign / Local (see [`../SOVEREIGN_LLM_GUIDELINES.md`](../SOVEREIGN_LLM_GUIDELINES.md)). Gemma 4 E4B is an approved model on this track (Decision [2026-10-30-0001] in [`../DECISION_LOG.md`](../DECISION_LOG.md)).
> **Audience:** Builders who want a PII filter that never sends data off the machine.

You want to use cloud models for the hard work, but some of your data must not leave the building. This guide puts a PII filter in front of every outbound call. The filter runs on a Mac you own, using a small open model served by [LM Studio](https://lmstudio.ai). Nothing it inspects leaves that Mac.

It implements the [`security/pii-scan`](../../skills/security/pii-scan.md) skill and gives the [PIIGuard](../../agents/guardian/pii-guard.md) persona a local engine.

**What you get**

* A local endpoint that takes a payload and returns `APPROVED`, `FLAGGED`, `REDACTED`, or `BLOCKED`.
* Two detection passes: fixed patterns first, then a small Gemma model for the PII that patterns miss.
* Fail-closed behavior: if the model is down or answers badly, the payload is blocked.
* Gemma 4 speed figures for a Mac mini M4 and a MacBook Pro M1 Max, so you can size your own hardware.

---

## Why the filter has to be local

To find PII in a document, something has to read the document. If that something is a cloud API, the PII has already left. A PII filter is only useful if it runs inside your perimeter.

A small local model is good enough for this job. It does not need to write well or reason deeply. It needs to spot names, addresses, health details, and account numbers in free text, and return them in a fixed format. Models in the 1B–4B range do this on a laptop.

---

## Architecture

```
 Agent / n8n workflow
        │  payload + destination context
        ▼
 ┌──────────────────────── your Mac ────────────────────────┐
 │  PII gateway (Node.js)                                    │
 │   1. Pattern pass   SSN, Luhn card numbers, email, phone, │
 │                     API keys, connection strings          │
 │   2. Model pass  ──▶ LM Studio  (localhost:1234/v1)       │
 │                     Gemma, JSON-schema output             │
 │   3. Merge + redact  typed placeholders                   │
 │   4. Verify         rescan; anything left over → BLOCKED  │
 │   5. Decide         APPROVED / FLAGGED / REDACTED / BLOCKED│
 │   6. Audit record   findings by type, never raw values    │
 └───────────────────────────────────────────────────────────┘
        │  sanitized payload only
        ▼
 Cloud LLM / SaaS API
```

Four design rules keep this safe:

1. **The model can only add redactions.** The pattern pass always runs, and the model cannot remove its findings. A prompt injection hidden in the payload can at worst cause extra redaction, never less.
2. **The code redacts, not the model.** The model returns the spans it found. The gateway checks each span really appears in the payload, merges overlapping spans, and replaces each one once. The model never rewrites the payload, so it cannot drop or invent content.
3. **Verify before release.** After redaction the gateway scans the result again. If any detected value or pattern is still present, the payload is `BLOCKED`.
4. **Fail closed.** If LM Studio is unreachable, times out, or returns invalid JSON, anything headed to a `public_api` destination is `BLOCKED`.

---

## Hardware: two Macs, two Gemma 4 models

We ran Gemma 4 in LM Studio on two Macs, and both handled the job. The figures below are **published community benchmarks** on the same hardware, not our own measurements yet. They use the MLX engine with 4-bit models.

| | Mac mini M4 | MacBook Pro M1 Max |
| --- | --- | --- |
| Unified memory | 24 GB | 64 GB |
| GPU cores | 10 | 32 |
| Memory bandwidth (Apple spec) | 120 GB/s | 400 GB/s |

**Gemma 4 E4B** (small, about 4B effective parameters)

| | Mac mini M4 | MacBook Pro M1 Max |
| --- | --- | --- |
| Reading the input (prefill) | ~595–611 tok/s | ~605–628 tok/s |
| Writing the answer (generation) | ~20 tok/s | ~62 tok/s |
| Peak memory | ~7 GB | ~4.6–5.5 GB |
| Estimated seconds per payload* | ~6 s | ~2.5 s |

**Gemma 4 26B-A4B** (mixture of experts: 26B total, about 4B active per token)

| | Mac mini M4 | MacBook Pro M1 Max |
| --- | --- | --- |
| Reading the input (prefill) | ~317–370 tok/s | ~428–492 tok/s |
| Writing the answer (generation) | ~33–35 tok/s | ~48–51 tok/s |
| Peak memory | ~14–15 GB | ~13.5–14 GB |
| Estimated seconds per payload* | ~5 s | ~3.5 s |

\* Our estimate, not a measurement: a 600-token input (system prompt plus a short email or ticket) and a 100-token JSON answer, at the speeds above.

**Measured** through LM Studio with Gemma 4 E4B (MLX **8-bit**) on our test set, once warm:

| | Mac mini M4 | MacBook Pro M1 Max |
| --- | --- | --- |
| Seconds per document, p50 | 5.4–5.9 s | 2.2–2.4 s |
| Seconds per document, p95 | 6.4–6.9 s | 3.3–3.7 s |

Both match the estimates above, even at 8-bit. The M1 Max is about 2.4 times faster per document. For a filter that runs on each outbound message, both are usable; for bulk batches, the M1 Max finishes much sooner.

Sources: oMLX community benchmarks for [E4B on M4 24 GB](https://omlx.ai/benchmarks/vmwl71wm), [E4B on M1 Max 64 GB](https://omlx.ai/benchmarks/x1aonmwr), [26B-A4B on M4 24 GB](https://omlx.ai/benchmarks/prbwpsfp), and [26B-A4B on M1 Max 64 GB](https://omlx.ai/benchmarks/performance/9kxh72hk). A Mac mini M4 24 GB user on [Hacker News](https://news.ycombinator.com/item?id=47624731) reported 19.45 tok/s for E4B in LM Studio, in line with the oMLX figure.

**What the numbers say**

* **The gap is in writing, not reading.** Both Macs read input at about the same speed. For E4B, the M1 Max writes about 3 times faster, close to its 3.3× memory-bandwidth advantage. That is why the older laptop feels much faster in chat.
* **A PII filter mostly reads.** It takes in a whole document and writes back a short list of findings. So the Mac mini is closer to the M1 Max for this job than chat speed suggests. Keep the model's answer short (spans only, never the rewritten text) to keep it that way.
* **The bigger model is not slower on the Mac mini.** 26B-A4B only activates about 4B parameters per token, so on the M4 it writes faster than E4B. The cost is memory: about 15 GB of the Mac mini's 24 GB.
* **Memory headroom matters on the Mac mini.** macOS lets the GPU use only part of unified memory by default. With 26B-A4B the Mac mini has little room for long documents or other apps. Check what LM Studio reports before you choose.

**Recommendation** (Gemma 4 E4B caught 48 of 50 planted items on both Macs with the included test set, and 50 of 50 on the Mac mini with our first test set; see [Step 3](#step-3-test-it-with-synthetic-data-only))

* **Mac mini M4 24 GB:** Gemma 4 **E4B**. It uses about 7 GB, so the Mac mini can run all day as the team's PII gateway with room to spare.
* **MacBook Pro M1 Max 64 GB:** Gemma 4 **26B-A4B**. It is fast here and leaves plenty of memory. Use it to test whether the larger model catches PII that E4B misses.
* If 26B-A4B clearly catches more on our test set, it can also run on the Mac mini, with shorter documents and nothing else heavy running.

---

## Step 1: Install LM Studio and load a model

1. Install LM Studio from [lmstudio.ai](https://lmstudio.ai).
2. Download **Gemma 4 E4B** (`google/gemma-4-e4b`), or 26B-A4B on a 32 GB+ Mac. On Apple Silicon, pick an **MLX** build. Our measured results use the 8-bit build; 4-bit uses less memory and writes faster.
3. Install the command-line tool and start the server:

```bash
lms server start            # OpenAI-compatible API on http://localhost:1234/v1
lms load google/gemma-4-e4b
lms ps                      # confirm the model is loaded
curl -s http://localhost:1234/v1/models
```

Keep the server on **localhost** unless another machine needs it. If the Mac mini serves the team, see [Hardening](#hardening).

---

## Step 2: The gateway

The gateway is one TypeScript file with no dependencies: [`examples/lm-studio-pii-gateway/pii-gateway.mts`](../../examples/lm-studio-pii-gateway/pii-gateway.mts). Node 24 runs it directly, with no build step.

It exports one function:

```ts
import { scan } from "./pii-gateway.mts";

const result = await scan(emailText, "public_api");
// result.status:   "APPROVED" | "REDACTED" | "BLOCKED"
// result.payload:  the sanitized text (absent when BLOCKED)
// result.findings: types and counts only, never the values
```

Configuration comes from the environment (Fetch-on-Demand):

| Variable | Default | Meaning |
| --- | --- | --- |
| `LMSTUDIO_URL` | `http://localhost:1234/v1` | LM Studio's OpenAI-compatible endpoint |
| `PII_MODEL` | none | LM Studio model key, for example Gemma 4 E4B |
| `PII_TIMEOUT_MS` | `15000` | Per-request timeout. On timeout, a `public_api` payload is blocked. |

What `scan()` does, in order:

1. **Pattern pass.** SSNs, Luhn-valid card numbers, emails, phone numbers and API keys. Each piece of text is claimed by one pattern only.
2. **Model pass.** Sends the payload to LM Studio with a JSON schema, so the answer is always a list of `{ type, value }` findings. The system prompt tells the model the payload is data, never instructions.
3. **Span check.** Drops any model finding that does not appear word for word in the payload.
4. **Name parts.** For each name the model found, also redacts each part of it as a whole word, so "Priya Raman" also removes a later "Regards, Priya", but "Leo" never cuts into "Leonard".
5. **Redact.** Marks every occurrence of every finding, merges overlapping spans, and replaces each span with a typed placeholder such as `[REDACTED_NAME]`.
6. **Verify.** Scans the result again. If anything detected is still there, the payload is `BLOCKED`.

> Not yet covered: the `FLAGGED` status (internal data) and `strict` mode from the [skill contract](../../skills/security/pii-scan.md). This first version redacts or blocks.

---

## Step 3: Test it with synthetic data only

Never test with real customer data. The example includes a synthetic test set, [`test-set.json`](../../examples/lm-studio-pii-gateway/test-set.json): 10 documents (4 emails, 3 bills, 3 messages), each with 5 planted PII items and 2 ordinary phrases that must survive. All values are fictional: `example.com` emails, 555-01xx phone numbers, the SSN range reserved for advertising, and published test card numbers and IBANs.

Run it with LM Studio open and the model loaded:

```bash
cd examples/lm-studio-pii-gateway
PII_MODEL=google/gemma-4-e4b node run-eval.mts
```

It reports:

* **PII caught (recall).** An item counts as caught only if the whole value, every word of four or more characters in it, and every listed variant is gone. A surname left behind is a miss. This is the number that matters most.
* **Over-redacted.** Ordinary phrases that were removed, such as an invoice number.
* **Seconds per document,** p50 and p95, measured through LM Studio.

The script exits with an error on any miss or block. Run it again whenever you change the model, the quantization or the prompt.

### Results

| Run | Documents | PII planted | Caught | Recall | Over-redacted |
| --- | --- | --- | --- | --- | --- |
| Gemma 4 E4B on Mac mini M4 24 GB, our first test set | 10 | 50 | 50 | 100% | not measured |
| Pattern pass only (no model), included test set | 10 | 50 | 19 | 38% | 0 |
| Gemma 4 E4B (MLX 8-bit) on MacBook Pro M1 Max 64 GB, included test set | 10 | 50 | 48 | 96% | 2 |
| Gemma 4 E4B (MLX 8-bit) on Mac mini M4 24 GB, included test set | 10 | 50 | 48 | 96% | 2 |

What this shows:

* **The model does most of the work.** Fixed patterns catch SSNs, cards, emails and phone numbers: 19 of the 50 items. Names, addresses, health details and most ID numbers depend on the model.
* **Gemma 4 E4B caught 48 of 50 on both Macs** with the included test set, and 50 of 50 on the Mac mini with our first test set. Every repeat run on the same machine gave the same result, so the model's behavior is stable at temperature 0.
* **The same model file can answer differently on different Macs.** Before the name-part step, the Mac mini missed the bare "Priya" in an email signature that the M1 Max caught (47/50 versus 48/50), with the same 8-bit build and the same prompt. Small numeric differences between GPU generations can change a small model's output. Run the test set on the machine that will run the filter.
* **What it missed:** a date of birth written as `07/22/1979`, and the medication "antibiotics" (it removed the diagnosis, "pneumonia", in the same sentence). Both are cases worth adding to your own test set.
* **What it over-redacted:** two bill totals (`€142.60`, `$380.00`). That errs on the safe side, but it can remove meaning a downstream model needs.
* **More prompt wording did not help.** A longer prompt that listed dates of birth, medications and "not prices" dropped recall to 88% (44/50). A shorter addition kept 96% but missed a full name instead. Small models react unpredictably to wording, so keep the prompt short and rerun the test set after every change.
* **Read this as a good first sign, not a guarantee.** With about 100 items, a miss rate of a few percent is plausible. Before you rely on it for regulated data, grow the test set with harder cases: names in signatures, addresses split over lines, IDs in tables, dates in every format.

---

## Step 4: Wire it in

* **n8n:** call the gateway as the first node, and route on `status`. Only `APPROVED` and `REDACTED` payloads continue to the cloud model node. `TODO`: screenshot or template.
* **Coding agents / scripts:** call `scan()` before any outbound model call, and send `payload` from the result, never the original.
* **Audit:** log the result's `status` and `findings` summary. Do not log the original payload.

---

## Hardening

* **Bind to localhost** by default. Turn on LM Studio's local-network serving only for a dedicated gateway Mac, and restrict access with the macOS firewall or your network.
* **Require a key** if the server is reachable from the network. Fetch it on demand (`op run` / `infisical run`), never store it in a file. `TODO`: confirm the current LM Studio auth option and document it.
* **Check LM Studio's logs.** Verbose server logging can include request content, which here is raw PII. `TODO`: verify which LM Studio logs persist prompts, and how to turn that off.
* **Pin the model.** Record the exact model and quantization in your operating profile, so a silent swap cannot lower recall.
* **Use a separate machine identity** for any agent that calls the gateway. See [`../MACHINE_IDENTITY.md`](../MACHINE_IDENTITY.md).

---

## Limits

* A small model will miss some PII. The pattern pass and fail-closed rules reduce the risk; they do not remove it. Keep a human approval on anything sensitive that is sent out.
* Redaction can remove the meaning a downstream model needs. When that happens the skill contract says `BLOCKED`, not a half-useful payload.
* This is one layer. It works alongside [PromptShield](../../agents/guardian/prompt-shield.md) and the [Phase 0 baseline](../PHASE_ZERO_SECURITY_BASELINE.md), not instead of them.

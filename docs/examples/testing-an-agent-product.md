# Testing an Agent Product

How to test a product built from code, prompts and a model, so that pull requests are checked quickly and cheaply, and the model's own behaviour is still measured. [Discernment §1](../lifecycle/DISCERNMENT.md) gives the principle and the layers. This guide covers the practice: what runs on every pull request, what runs by hand, and the techniques that catch the failures agent products actually have.

## Two tiers

| | Tier A: deterministic | Tier B: live evals |
|---|---|---|
| Calls a model | Never | Yes |
| Runs | On every pull request | By hand, from the CI's manual trigger |
| Cost | None | Real model spend |
| Result | Same every run | Can vary between runs |
| Checks | Code, wiring, formatting, guards, detectors | Whether the model uses its tools and states what they returned |

Most of what can go wrong in an agent product is code: a guard that runs in the wrong order, a fake that hides a paging bug, a formatter that breaks a message limit, an agent that was quietly given a send tool. Tier A catches those on every change. Tier B measures what only a model run can show, and it costs money each time.

## Tier A: deterministic tests

### Make an accidental model call fail
Give the PR job a dummy API key, such as `dummy-key-not-used-by-tier-a-tests`, instead of leaving the variable unset. A test that reaches a model by mistake then fails loudly on authentication, instead of silently skipping, or billing if a real key ever leaks into the job.

### Stub the network, and split rendering from sending
Stub `fetch`, or the HTTP client, in every test that talks to an API, so tests need no credentials and hit no network. Split each publisher into a pure `render` and a `publish`. Every formatting rule can then be checked against a string: the exact text each destination receives, length limits measured on what is sent, and escaping.

### Make fakes as awkward as the real API
A fake that returns one tidy row lets every agent pass. Reproduce the quirks that actually broke something: a fixed page size that ignores the requested `limit`, rows with empty dates sorted first, two different response envelopes depending on a parameter, a field that appears only for some callers. Record response shapes from the live API and build fixtures from them. **Test the fake's own behaviour too.** A fake whose paging is wrong hides the paging bug a second time.

### Pin the framework's behaviour with tests, not comments
A design often leans on a framework behaviour, for example that a function-valued agent setting is re-resolved on every call. A comment saying "verified against version X" cannot fail. Write a test that asserts the behaviour directly, so a framework upgrade that changes it turns the CI red instead of becoming a production mystery.

### Count the wiring
Some properties are about what is connected, not what a function returns:
- **No agent holds a send, publish, approve or bulk tool.** List every agent's tools and fail on any match. Accept both `_` and `-` as word boundaries in the pattern, and keep a negative test with a deliberately forbidden fake name, so the pattern is proven to catch something.
- **The agent list matches the agent definitions on disk**, so a new agent cannot skip the census.
- **Order matters where behaviour tests cannot see it.** When cheap guards must run before a model call or a storage read, a structural test over the handler can assert the order. A reshuffle there widens what is read without failing any behavioural test.

### Test guards under concurrency and tampering
Approval transitions, single-use drafts and rate limits are where "it worked when I clicked it" is not enough. Run concurrent callers against a single-use transition and assert that exactly one wins. Feed forged ids, swapped recipients and edited files, and assert that each is refused before anything is sent.

### Wait for a condition, not for time
A test that sleeps 20 ms for an asynchronous update passes on a fast machine and fails on a busy CI runner. Wait for the condition instead, with a bounded number of retries and a clear failure message when the bound is reached.

## Deterministic detectors

Some model failures can be recognised without another model. Write them as detectors: small functions that score a recorded run, used both in tests and, where it helps, in production.

- **Score the evidence, not the wording.** An "unsupported negative" detector scores 0 when the answer says nothing matched while a tool result in the same run was marked incomplete. An answer that only looks plausible passes every check shaped around the output text. See the [Complete Retrieval](../../skills/verification/complete-retrieval.md) skill and its reference check.
- **Test detectors in pairs.** Use the same answer over a complete and an incomplete retrieval, or the same text with and without an email address. The pair pins the rule to the evidence, so rewording the answer cannot make it pass.
- **Pair a detector with an enforcing step where the rule must hold.** A scorer that reports "this output contains an email address" belongs beside a processor that removes or blocks it on the path where that matters. The scorer measures how often it happens; the processor makes sure it does not reach the reader.

A deterministic detector is cheaper, faster and more stable than an LLM judge for any rule that can be stated as code. Keep the judge for what cannot, such as tone and reasoning.

## Tier B: live evals

- **Manual trigger only.** Run evals from the CI's manual trigger, not on every pull request. They cost money, need a real key, and can fail on a model's variance rather than on the change. A template is in [`templates/ci/agent-evals.yml`](../../templates/ci/agent-evals.yml).
- **Use test doubles of the agents**: the same instructions and tools, with no memory and with side effects stubbed, so an eval touches nothing real and needs no storage.
- **Choose the eval model deliberately.** Pinning the doubles to an inexpensive model keeps eval cost from following the live tier; running them on the live model measures what production does. Write down which one the evals use.
- **Set temperature to 0**, and assert tool use and content: that the agent called the lookup tool, and that the answer states the date the tool returned. Do not assert exact wording.
- **Write cases in diagnosable pairs.** One case should pass with or without the fix under test, for example a record on the first page of a listing. A failure there means the harness is broken. The other reproduces the bug, for example a record on page two. A failure there means the fix is not working.
- **Write down the coverage gaps.** If an agent that writes customer-facing text has no eval, say so in the testing document, so the gap is a known item rather than an assumption.

## Paths only a person can test

Card buttons, modals and real chat formatting are hard to automate against a live workspace. Keep a short runbook of click-driven paths, run it in a development workspace before a release, and keep a dated record of the last run of each path. A path that has not been exercised since the code under it changed is then visible.

## Continuous integration

- **Pull request gate:** formatting, lint, commit messages, and Tier A. Required.
- **Evals:** Tier B, manual only, with the model key from a secret or the vault. Never required.
- Development services the tests need, such as a database, run in the job as service containers or in the test's own setup. State in the testing document which ones the CI actually provides, and keep that statement in step with the workflow.

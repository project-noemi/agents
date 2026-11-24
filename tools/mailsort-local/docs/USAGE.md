# Usage guide

Complete the [setup guide](SETUP.md) first: build the image, configure `.env`,
authorize Gmail, prepare your labels, and verify the small dry-run and storage
checks. Run the commands below from the repository root with Docker and Ollama
running. Keep the computer awake for scheduled processing.

The single-line Docker commands work in Linux/macOS terminals and Windows
PowerShell. Platform-specific file-copy and log-viewing commands are marked.
Windows/macOS deployment remains untested end to end; the networking and file
permissions described in setup still apply.

## Choose a workflow

| Use case | What happens | Gmail changes? | Persistent CSV? |
| --- | --- | --- | --- |
| Fictional example emails | Test the local model without Gmail | No | No |
| Gmail dry-run | Classify a small mailbox search | No | No |
| Review plan | Save predictions, edit selections, preview, then explicitly apply | Only with `--apply` | Yes |
| Direct labeling | Classify and preview or apply without a review file | Only with `--apply` | Yes |
| Automatic processing | Check eligible messages once or on a schedule | Only with `--apply` | Yes, for classification cycles |

`--apply` enables label additions to messages. These workflows preserve unrelated
labels and do not archive, delete, send, or reply to mail. Required label definitions
must already exist in Gmail; create/import them during setup.

Each command uses `compose.yaml` plus **one** workflow override. Do not combine
the dry-run, labeling, and automatic overrides in one command. The two `-f`
arguments select the files; `run --rm -T` starts a one-off container, removes it
when finished, and disables terminal allocation for plain output. The application
image and mounted files remain. A one-off command exits when its work finishes;
the scheduled worker uses `up -d` instead.

Stop a running automatic worker before manual labeling or one-off automatic
commands, as explained under [worker management](#manage-the-worker). The worker
holds a shared processing lock for its lifetime, including while waiting for
its next scheduled check. Live manual labeling and all automatic commands that
open processing state cannot run alongside it using the same state folder.

## Select your configuration

Examples below use the shared five-label catalog and model settings. The Gmail
dry-run uses labels-only mode by default; the labeling and automatic examples
explicitly choose confidence mode. See [prompt modes and thresholds](PROMPT_NOTES.md#choose-a-mode-and-configure-thresholds)
for the trade-offs.

Append these options **after `app`** when you need private settings:

| Option | Selects |
| --- | --- |
| `--labels user-config/labels.json` | Your configured private label catalog |
| `--model-config user-config/model.json` | Your local model and input/context settings |
| `--processing-config user-config/processing.json` | Search query and message limit for manual workflows only |
| `--automatic-config user-config/automatic.json` | Schedule, time window, query, and limits for automatic workflows only |
| `--mode confidence` | Confidence scores evaluated against each enabled label's threshold |
| `--mode labels` | Label predictions without confidence thresholding |

Only select files you have actually created. The host's `config/` folder is
mounted at `/app/user-config`; selecting a private filename activates it.
Creating the file alone does not change the defaults. Keep the same catalog
selection throughout review-plan creation, preview, and application.

Most default examples live inside the built image; rebuilding is necessary to
update their bundled copies. Private mounted configurations avoid that. A running
worker reads its settings at startup, so restart/recreate it after changes. See
the [configuration notes](CONFIG_NOTES.md) for settings and mount details.

## 1. Classify the fictional example emails

```sh
docker compose -f compose.yaml -f compose.ollama.yaml run --rm -T app
```

This classifies the two fictional messages in
[`examples/emails.example.json`](../examples/emails.example.json) using the base
catalog and local model. It prints validated predictions and makes no Gmail
connection. The supplied override selects the input file, model settings,
catalog, and labels-only mode.

Arguments after `app` replace this override's whole default command. When
customizing the fictional-email test, repeat all required input/configuration
arguments. For example, after creating both private files:

```sh
docker compose -f compose.yaml -f compose.ollama.yaml run --rm -T app --model-config user-config/model.json --labels user-config/labels.json --mode confidence --emails examples/emails.example.json
```

This uses your private model/catalog and confidence mode on the same fictional
emails. It still makes no Gmail connection or CSV log.

## 2. Preview classification of real Gmail messages

```sh
docker compose -f compose.yaml -f compose.dry-run.yaml run --rm -T app
```

This searches your **real Gmail mailbox**, retrieves matching messages, calls
Ollama, and prints predictions and label mappings without applying labels.
Expect `dry_run: true`. It does not write a CSV log or mark messages completed.

The shipped [`processing.example.json`](../config/processing.example.json)
selects up to five messages from the last seven days without user-created labels,
excluding sent mail and drafts. It includes read and unread mail and is not
restricted to the inbox. If no messages match, the model is not invoked.

For an imported catalog and confidence scores:

```sh
docker compose -f compose.yaml -f compose.dry-run.yaml run --rm -T app --labels user-config/labels.json --mode confidence
```

This uses your private category definitions and thresholds. Resolve any
`mapping_problems`, and review the quality of predictions before enabling writes.
For a different manual search or limit, also select your private processing JSON.

## 3. Review and edit predictions before applying labels

### Create a new plan

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T app --plan-output /app/review/batch-001.json --mode confidence
```

This classifies the configured manual search, saves a new plan at
**`private/review/batch-001.json` on the host**, and appends `plan_created` rows
to the CSV log. It makes no Gmail changes. An existing plan is never overwritten;
choose a new filename for another batch. Add private catalog, model, and processing
options if needed.

Review plans include message IDs, senders, subjects, predictions, and decisions,
but no full email bodies. Keep them private.

### Edit the plan

Open the host file in your editor. Each message starts with `"decision": "pending"`.
Edit only its `selected_labels` and `decision` fields. For example:

```json
{
  "selected_labels": ["Promotions"],
  "decision": "approve"
}
```

This is an excerpt from one message row, not a replacement for the whole plan.
Choose `approve` to accept the selections or `skip` to leave the message untouched.
You may change the selected names or choose `[]` for no labels. Approved names
must be unique enabled labels within `max_labels_per_email` in the selected
catalog. Explicit human selections override scores and confidence thresholds;
editing the original prediction or saved Gmail IDs does not change the selections.

### Preview the edited decisions

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T app --review-plan /app/review/batch-001.json
```

This validates the file and refreshes the Gmail name-to-ID mappings. It does not
rerun the mailbox search or the model, and makes no Gmail changes. CSV rows record
the preview. Expect `ready: true` after changing every pending decision to
`approve` or `skip` and resolving missing/conflicting Gmail labels. Use the same
`--labels` selection as when creating the plan.

### Apply the reviewed plan

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T app --review-plan /app/review/batch-001.json --apply
```

**This changes Gmail:** it adds the approved labels to the exact message IDs in
the saved plan. It performs no model calls or new mailbox search. Success reports
`dry_run: false`, `applied_count`, and per-message outcomes, and records them in
the CSV log. Verify the small first batch in Gmail before using direct or
automatic labeling.

The plan file is not modified or consumed after application. Reapplying it is
possible; do not treat its continued existence as proof that it has not been
applied. Keep the selected catalog consistent. The saved plan determines the
prediction mode, so `--mode` is unnecessary for previewing/applying it.

## 4. Label messages without a review file

First preview the direct workflow:

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T app --no-review --mode confidence
```

This classifies the manual search, automatically selects validated eligible
labels, and prints what would be applied. It writes CSV preview rows, but makes
no Gmail changes and does not create a review plan. `--no-review` alone does not
enable writes.

After verifying a small reviewed write, enable direct labeling:

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T app --no-review --mode confidence --apply
```

**This changes Gmail without a per-message review pause.** It runs a **fresh**
mailbox search and classification; messages and predictions can differ from the
earlier preview. Use the saved-plan workflow when you want to apply the exact
decisions you reviewed. Empty accepted-label sets leave the messages unchanged.
Add the same private configuration options to both commands when using them.

Manual labeling writes CSV results but does **not** update the automatic worker's
completion records. Default searches usually exclude successfully labeled mail
because it now has user labels; a broader query can select it again.

## 5. Configure automatic processing

### Create private automatic settings

**Linux/macOS:**

```sh
cp -n config/automatic.example.json config/automatic.json
```

**Windows PowerShell:**

```powershell
if (-not (Test-Path -LiteralPath 'config/automatic.json')) { Copy-Item -LiteralPath 'config/automatic.example.json' -Destination 'config/automatic.json' }
```

These commands copy the shared example without overwriting an existing private
file. Edit `config/automatic.json`; keep all seven keys:

```json
{
  "timezone": "UTC",
  "schedule": {"type": "interval", "minutes": 60},
  "query": "has:nouserlabels -in:sent -in:drafts",
  "lookback_hours": 24,
  "initial_since": null,
  "max_messages_per_run": 5,
  "batch_size": 5
}
```

| Setting | Effect |
| --- | --- |
| `timezone` | IANA timezone for daily scheduling and the initial date; choose your own region/city when using local time |
| `schedule` | The example waits 60 minutes after a run finishes; replace it with `{"type":"daily","time":"02:00"}` for one scheduled attempt per local day |
| `query` | Gmail search scope, combined with the automatic time window |
| `lookback_hours` | Rolling search window for normal checks; the example searches the preceding 24 hours |
| `initial_since` | `null` disables an initial backlog pass; a past `YYYY-MM-DD` date enables processing from that date's local midnight |
| `max_messages_per_run` | Positive limit on pending messages per run; `null` selects all pending matches, which can require a long classification run |
| `batch_size` | Number of emails retrieved, classified, and labeled before the next batch, from 1 to 500; it does not change the total run limit, and each email gets its own model request |

The automatic worker uses **these settings**, not `processing.json`. Keep limits
small while testing. If an initial pass is unfinished, it starts immediately
at worker startup, even outside a daily schedule; later scheduled checks continue
a capped backlog. Without a previous interval record, interval processing also
starts immediately. The worker checks whether a run is due about every 30 seconds.

Normal lookback windows do not expand automatically after downtime. Choose a
window and run capacity that can keep up with incoming messages. To catch up on
older mail, deliberately increase the window or configure an initial date; keep
completion records so successfully processed messages remain skipped. See the
[automatic configuration reference](CONFIG_NOTES.md#automaticexamplejson--automatic-processing)
for details.

### Validate, count, and preview one cycle

Validate local configuration without Gmail or model requests:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml run --rm -T app --automatic-config user-config/automatic.json --mode confidence --check-config
```

Expect `configuration_valid: true` and the calculated model context allocation.
This command does not start a worker, write CSV rows, or record completion. Add
your private catalog/model/prompt options here and to the following one-off
commands if applicable.

Count matching and pending messages before spending time on inference:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml run --rm -T app --automatic-config user-config/automatic.json --mode confidence --count-only
```

This searches Gmail message IDs and reads existing local completion state. It
does not retrieve bodies, invoke the model, change Gmail, write CSV results, or
mark messages completed. `pending_count` describes the full matching pending
scope before the per-run classification limit is applied.

Run one automatic cycle immediately as a dry-run:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml run --rm -T app --automatic-config user-config/automatic.json --mode confidence --once
```

`--once` bypasses waiting for the schedule, obeys the query/window/run limit,
prints a summary, and exits. It logs results to CSV but makes no Gmail changes
or completion records. An empty pending set does not invoke the model.

To run **one live automatic cycle** after verifying the small labeling test:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml run --rm -T app --automatic-config user-config/automatic.json --mode confidence --once --apply
```

**This adds eligible labels and saves completion records.** Unlike manual direct
labeling, it uses the automatic query/window and skips IDs already completed in
automatic state. It exits after one cycle rather than continuing on a schedule.

## 6. Start the scheduled worker

Create **`private/compose.automatic.yaml`** in your editor. The `private/` folder
was created during setup and is ignored by Git. Start with this dry-run profile:

```yaml
services:
  app:
    command:
      - --automatic-config
      - user-config/automatic.json
      - --labels
      - config/labels.example.json
      - --mode
      - confidence
```

This selects your private automatic settings, the base catalog, and confidence
mode, with **no Gmail writes**. For your own catalog, change its path to
`user-config/labels.json`. If needed, add `--model-config` and
`user-config/model.json` as two more command entries. These settings should match
the ones you verified above. A Compose `command` list supplies the arguments that
the scheduled service receives at startup.

Start the scheduled dry-run worker:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml up -d app
```

The third `-f` adds your private command configuration; `up -d` creates/starts
the service in the background. Docker's `unless-stopped` restart policy can
restart it after Docker/host restarts unless you explicitly stop it. Docker and
Ollama must be running, the computer must stay awake, and Gmail must be reachable.

The dry-run worker writes CSV results but never marks mail completed, so scheduled
previews can classify the same eligible messages again. Review its logs before
enabling live processing.

### Enable scheduled Gmail writes

After a small labeling test has succeeded in Gmail, stop the worker:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml stop app
```

This stops the background worker and releases its processing lock, preserving
configuration, state, and logs. During shutdown the app attempts model cleanup;
an interrupted Gmail write can have an uncertain outcome, so check logs/Gmail
if a run was active.

In your private Compose file, append this entry to the existing `command` list,
at the same indentation as the other arguments:

```yaml
      - --apply
```

This is an extra list item, not a replacement file. It enables Gmail label
additions and persistent completion tracking. Recreate the service to load it:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml up -d --force-recreate app
```

**The recreated worker can change Gmail immediately** if an initial pass is
pending or a scheduled check is due. `--force-recreate` replaces the container
and loads the updated command/mounts; the host's `data/` files survive. To return
to dry-run mode, stop it, remove the `--apply` entry, and recreate it again.

### Manage the worker

Check status:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml ps --all
```

This only reads container status; `--all` includes stopped containers. `Up` means
the worker process is running, not that its Gmail operations have succeeded.
Check logs too.

Read recent logs:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml logs --tail 100 app
```

This prints the latest 100 log lines without starting work. Logs include
classification progress, message outcomes, `batch_progress`, errors, and
`cycle_summary` entries. `batch_progress` is logged after a batch finishes its
labeling or preview step and includes cumulative completed/applied counts.
`selected_count: 0` means there was nothing pending to classify.
Classification progress alone does not confirm that labels were applied.

Follow new log output:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml logs -f --tail 50 app
```

`-f` follows output after the latest 50 lines. Ctrl+C stops following logs and
leaves the worker running. Container logs use UTC timestamps; daily scheduling
uses your configured timezone. Logs can contain private classifications and IDs.

To stop, use the `stop app` command above. To start the existing stopped service:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml start app
```

This resumes the existing container and command, including its existing write
mode. It does not load changes to Compose YAML or mounts.

After editing only mounted JSON or prompt files, restart the existing worker:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml restart app
```

This reloads those files at process startup and may resume writes immediately.
For changed Compose arguments, mounts, or `.env` paths, use the earlier stop and
`up -d --force-recreate app` commands instead. After changing application code
or bundled defaults, rebuild the image as described in setup and recreate the
worker. Recreating a container can discard its old container logs; the persistent
CSV remains available.

## 7. Read CSV results and preserve processing state

Manual labeling and automatic classification cycles append to **`data/results.csv`**
by default. Each row includes a UTC timestamp, source, model, mode, dry-run flag,
message ID, prediction, selected/applied labels, status, and error. Rows can
describe multiple attempts at the same message; this is an event history, not a
unique-message count. Full bodies are not logged.

To inspect the last 20 lines on **Linux/macOS**:

```sh
tail -n 20 data/results.csv
```

On **Windows PowerShell**:

```powershell
Get-Content -LiteralPath 'data/results.csv' -Tail 20
```

These commands only display recent CSV text. The file appears after a labeling
workflow or automatic classification cycle initializes logging; a standalone
Gmail dry-run does not create it. Keep this file private. You may also open it in
a spreadsheet application for inspection without changing the source CSV.

| Status | Meaning |
| --- | --- |
| `plan_created` | Predictions saved to a review plan; no Gmail changes |
| `pending` / `skipped` | A review decision is unresolved or explicitly skipped |
| `would_apply` | Preview selected labels without applying them |
| `no_labels` | No accepted/selected labels; message left unchanged |
| `applied` | Gmail acknowledged the requested label additions |
| `blocked` | A selected label could not be uniquely resolved in Gmail |
| `outcome_unknown` | A write failed or its acknowledgement was unexpected; inspect Gmail before retrying |
| `not_attempted` | Label additions were not attempted after a preflight problem or earlier failure |
| `error` / `interrupted` | A run failed or was interrupted; inspect its other rows and logs |

To choose a different CSV, add `--results-file /app/state/another-results.csv`
after `app` in a labeling/automatic command, or as two entries in the scheduled
worker's command list. The parent folder must exist and be writable. The
`/app/state` mount keeps this file under the host's `data/` folder.

### Structured JSON audit records

Every event written to the CSV is also emitted as one JSON line on standard
error, together with Gmail base-label creation during setup. Docker includes
these lines in the container logs, so the `logs` commands above show them for the
worker; one-off commands print them in your terminal beside the normal output.
Each line follows the Project NoéMI audit shape:

```json
{"timestamp": "2026-11-24T21:00:00+00:00", "source": "automatic", "task": "Classify and label Gmail messages", "inputs": [{"message_id": "18c0example", "model": "qwen3:8b", "mode": "confidence", "dry_run": false, "prediction": {"Promotions": 0.92}}], "actions": [{"selected_labels": ["Promotions"], "applied_labels": ["Promotions"]}], "risks": [], "result": "applied"}
```

`source` is `manual`, `automatic` or `setup`; `result` uses the statuses in the
table above, or `created` for a verified base label. `risks` holds the same
sanitized error text as the CSV. Audit lines never contain email bodies, senders,
subjects, credentials or raw Gmail server replies.

To show only the audit lines from the worker's logs on **Linux/macOS**:

```sh
docker compose -f compose.yaml -f compose.automatic.yaml -f private/compose.automatic.yaml logs --no-log-prefix app | grep '^{'
```

`--no-log-prefix` removes Docker's service-name prefix, and `grep '^{'` keeps the
lines that start with a JSON object; the ordinary progress log lines start with a
date instead. Like the CSV, these logs can contain message IDs and
classifications, so keep them private.

**`data/processing.json` is separate from the CSV.** Live automatic processing
records completed message IDs/timestamps and schedule/initial-pass progress
there. Successful label additions and valid no-label results count as completed.
Dry-runs and failed/uncertain writes do not mark messages completed. Manual
labeling does not populate these completion records.

Preserve `data/` when replacing containers or updating the application. Deleting
state loses duplicate-processing prevention. Completed IDs remain skipped after
model, prompt, threshold, or catalog changes; the worker does not automatically
reclassify them. Use one state folder per mailbox and avoid overlapping workers.

An automatic run classifies and labels each retrieval batch before fetching the
next, saving successful completion per message. For example, 12 selected emails
with `batch_size: 5` are classified and labeled in groups of 5, 5, and 2. The
model session spans these batches; `unload_after_batch: true` requests unloading
once when the run exits. A later classification, retrieval, or labeling failure
keeps earlier successful progress, and the next run skips those completed IDs.
A labeling failure stops the run before the next batch is fetched. Previews do
not mark completion. Inspect Gmail after uncertain writes. Scheduled failures
normally wait for the next scheduled attempt, while durable-state write errors
stop the worker. Renew rejected OAuth consent using the [setup instructions](SETUP.md#6-authorize-gmail-through-the-bundled-mcp-server);
restarting Docker does not renew authorization. Remember that older failed mail
can fall outside the normal lookback window.

### Open an email in Gmail using its message ID

The `message_id` column in `results.csv` contains Gmail's internal message ID.
To open the corresponding email manually:

1. Open Gmail in your browser, using the same account that Mailsort processes.
2. Copy the email's `message_id` from the CSV.
3. Click the **browser's address bar**, keep the Gmail URL up to and including
   `#`, and replace everything after `#` with `all/MESSAGE_ID`, substituting the
   copied ID for `MESSAGE_ID`.
4. Press **Enter** to open the email or its conversation.

For example, an ID of `18abc123def45678` gives:

```text
https://mail.google.com/mail/u/0/#all/18abc123def45678
```

**Include `all/` before the ID.** Keep your existing account prefix, such as
`/u/1/` instead of `/u/0/`, if you have multiple Gmail accounts signed in. Open
Gmail first, then edit the URL in that tab.

Use the browser's address bar for this lookup. Gmail's search box does not
search by this internal ID; the `rfc822msgid:` search operator expects the
email's separate `Message-ID` header, not the CSV's `message_id` value.

## 8. Use custom prompts

Follow the [prompt notes](PROMPT_NOTES.md) to prepare all three templates in
`prompts/local/`. For a manual Gmail preview with your private catalog:

```sh
docker compose -f compose.yaml -f compose.dry-run.yaml run --rm -T --volume ./prompts/local:/app/local-prompts:ro app --labels user-config/labels.json --mode confidence --prompt-dir /app/local-prompts
```

This mounts the custom templates read-only (`:ro`), selects them with
`--prompt-dir`, and classifies the manual search without Gmail changes or CSV
logging. Docker options such as `--volume` go **before `app`**; application
options go after it. Keep the same mount and prompt selection when creating
plans or running direct classification.

For the scheduled worker, add this `volumes` entry under `services.app` in your
existing private Compose file, alongside `command`:

```yaml
    volumes:
      - ./prompts/local:/app/local-prompts:ro
```

Also append `--prompt-dir` and `/app/local-prompts` as two entries in its command
list. Relative Compose paths are resolved against the first Compose file, so
this refers to the repository's `prompts/local/` directory. Preserve the rest of
the profile, stop the worker, and recreate it to load the changed mount. Test
custom wording in a small dry-run before enabling writes.

For hardware, input/context limits, scheduling settings, and performance
trade-offs, see the [configuration notes](CONFIG_NOTES.md).

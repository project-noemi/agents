# Configuration guide

This guide explains the configuration files, supported values, and how to select
private settings without editing Python code. Complete the [setup guide](SETUP.md)
first, then use the [usage guide](USAGE.md) for commands that run each workflow.
The application reads the selected configuration files, not this document.

## Which configuration files are actually used?

All five JSON examples are working defaults for the relevant commands, not just
documentation templates. A default is loaded only when a command needs that
configuration; every command does not use every file.

| Shared file | Default use | Argument for selecting a different file |
| --- | --- | --- |
| `automatic.example.json` | Automatic worker schedule, search scope, and run limits. | `--automatic-config` |
| `gmail.example.json` | Gmail connection and authentication file locations. | `--gmail-config` |
| `labels.example.json` | Categories for Gmail classification workflows; also the source for base-label creation. | `--labels` for classification; base-label creation always uses the shipped catalog. |
| `model.example.json` | Model settings for Gmail classification workflows. | `--model-config` |
| `processing.example.json` | Search scope and message limit for manual dry-runs and message-labeling workflows. The automatic worker uses its own settings instead. | `--processing-config` |

Some standalone commands require explicit paths rather than supplying these
defaults: for example, `classify` requires both `--model-config` and `--labels`,
and the prompt-preview module requires `--labels`.

Creating a private file such as `config/model.json` or `config/labels.json`
does not activate it automatically. Select it with the appropriate argument in
the command you run, or in the worker's Compose command. Keep shared examples
generic and personal files separate.

### Host files versus files inside Docker

The Dockerfile copies the JSON examples into `/app/config` when building the
image. The supplied base Compose file also mounts the host's entire `config/`
folder read-only at `/app/user-config`. These are two different locations.

- **Default model file:** Compose additionally mounts the host's
  `config/model.example.json` directly over `/app/config/model.example.json`.
  Its edits are therefore visible at the default path without rebuilding.
- **Other default examples:** There is no additional mount over their
  `/app/config` paths. To update those bundled defaults after editing the host
  examples, rebuild the image and recreate containers using it. A restart alone
  does not replace an existing container's image.
- **Explicitly selected mounted files:** Selecting a file under `user-config/`,
  such as `--labels user-config/labels.json`, reads the host's mounted copy and
  avoids rebuilding for configuration edits. This also works for an example
  selected explicitly as, for example,
  `--gmail-config user-config/gmail.example.json`.

A long-running worker loads settings at startup, so restart it after changing
the selected mounted configuration. For a one-off command, the next invocation
loads the file again. Updating command arguments in Compose requires recreating
the worker with the updated command.

### `.env.example` is a template only

Docker Compose does not automatically read `.env.example`. Copy it to a private
`.env` in the repository root and customize that file. Unlike the JSON examples,
the `.env.example` file is not an active default configuration.

## `processing.example.json` — manual search and message limits

The [shared example](../config/processing.example.json) supplies defaults for
Gmail dry-runs, review-plan creation, and direct manual labeling:

```json
{
  "query": "newer_than:7d has:nouserlabels -in:sent -in:drafts",
  "max_messages": 5
}
```

Keep exactly these two keys. JSON comments and extra keys are not supported.

| Setting | Purpose and allowed values | Example default |
| --- | --- | --- |
| `query` | Non-empty Gmail search expression. The application checks that it is non-empty; Gmail interprets the search syntax. | `"newer_than:7d has:nouserlabels -in:sent -in:drafts"` |
| `max_messages` | Whole number from `1` to `500`, inclusive, limiting messages retrieved and classified by one manual invocation. `null` is not accepted. | `5` |

The example selects recent messages without user-created labels, excluding sent
mail and drafts. It includes read and unread mail and is not limited to the
inbox. Start with a small limit, such as `1`, while testing. No matching messages
means no model calls.

Create a private copy before editing the query or limit.

**Linux/macOS:**

```sh
cp -n config/processing.example.json config/processing.json
```

**Windows PowerShell:**

```powershell
if (-not (Test-Path -LiteralPath 'config/processing.json')) { Copy-Item -LiteralPath 'config/processing.example.json' -Destination 'config/processing.json' }
```

These commands preserve an existing private file. Edit `config/processing.json`
and explicitly select its mounted container path when running a manual workflow:

```sh
docker compose -f compose.yaml -f compose.credentials-files.yaml -f compose.dry-run.yaml run --rm -T app --processing-config user-config/processing.json
```

This single-line command works in Linux/macOS terminals and Windows PowerShell
after setup. It searches real Gmail messages using your private settings and
prints classification results without changing Gmail labels or writing CSV
results. `--rm` removes the finished container; `-T` disables terminal allocation.
The same `--processing-config` option selects this file for manual plan creation
and direct labeling.

Previewing or applying an existing review plan uses its saved message IDs and
decisions rather than running a new search. The automatic worker uses its own
`query`, time window, and `max_messages_per_run` from the automatic settings below;
it does not read this manual processing file.

### Build your query with Gmail search operators

The `query` value uses the same search operators as Gmail's search box. Edit it
in your private `config/processing.json`, then select that file as described
above. Paste the expression into Gmail's search box first to preview its scope;
searching does not change messages. See Google's
[full search operator reference](https://support.google.com/mail/answer/7190?hl=en).

| Operator | Meaning |
| --- | --- |
| `newer_than:7d` | Messages newer than seven days; change the number or use `m` for months and `y` for years |
| `in:inbox` | Restrict the search to the inbox |
| `has:nouserlabels` | Messages without user-created labels |
| `from:shop@example.com` | Messages from a particular sender |
| `subject:invoice` | Messages with the term in their subject |
| `is:unread` | Restrict the search to unread messages, if desired; unread status is not the application's completion tracking |
| `-in:sent -in:drafts` | Exclude sent messages and drafts; a leading `-` excludes a condition |

Combine conditions with spaces. For example, search the inbox for unlabeled
messages from the last 30 days:

```text
in:inbox newer_than:30d has:nouserlabels -in:sent -in:drafts
```

Or restrict recent unlabeled messages to a sender, replacing the example address:

```text
from:shop@example.com newer_than:7d has:nouserlabels -in:sent -in:drafts
```

Put the expression inside the JSON `query` string; `max_messages` remains a
separate application limit. This search does not create a saved Gmail filter.
If an existing Gmail filter has already applied a user label, `has:nouserlabels`
excludes that message from this application's search.

## `automatic.example.json` — automatic processing

Keep all seven settings in the JSON file. Extra keys and comments are not
supported. Use whole numbers where a setting asks for an integer, and write
`null` without quotes where it is allowed.

### `timezone`

The timezone used for daily run times and the start of an initial processing
date. It does not change the length of an interval or a lookback window.

- **Allowed values:** a timezone name available in the container, such as
  `"UTC"`, `"Europe/Budapest"`, or `"America/New_York"`.
- **Example default:** `"UTC"`.
- Use a region/city name for local scheduling so daylight-saving changes are
  handled automatically.

### `schedule`

Choose one of these two forms:

- **Interval:** `{"type": "interval", "minutes": 60}`. Here, `type` must be
  `"interval"` and `minutes` must be a whole number of at least `1`. The worker
  waits this many minutes after a run finishes before its next check. With no
  previous schedule record, the first check runs immediately.
- **Daily:** `{"type": "daily", "time": "02:00"}`. Here, `type` must be `"daily"`
  and `time` must use two-digit, 24-hour `HH:MM` format, from `"00:00"` to
  `"23:59"`. The worker makes one scheduled attempt per local day in `timezone`.
  Starting after that time triggers today's check if no attempt was recorded.

Do not combine `minutes` and `time`. The worker checks whether a run is due about
every 30 seconds, so the start time is approximate. The computer and worker must
be running for scheduled checks to happen.

### `query`

The Gmail search expression that selects which emails may be processed. The
worker also applies its time window and skips message IDs already recorded as
completed.

Use the same [Gmail search operators](#build-your-query-with-gmail-search-operators)
in your private automatic configuration. Additional date conditions narrow the
worker's configured time window; they do not expand it.

- **Allowed values:** a non-empty string containing a Gmail search expression.
  The app checks that the string is non-empty; Gmail interprets the search.
- **Example default:** `"has:nouserlabels -in:sent -in:drafts"` selects messages
  without user-created labels and excludes sent mail and drafts. It includes
  both read and unread messages and is not limited to the inbox.
- To restrict the example to the inbox, use
  `"in:inbox has:nouserlabels -in:sent -in:drafts"`.

### `lookback_hours`

How far back normal checks search, measured from the start of each run.

- **Allowed values:** a whole number of at least `1`.
- **Example default:** `24`, meaning the preceding 24 hours.
- For a three-day window, use `72`. The window does not automatically expand
  after downtime. Emails outside it are not considered by normal checks.

### `initial_since`

Optionally process older emails before switching to the normal lookback window.
The same `query` and per-run limit still apply.

- **Allowed values:** `null` to disable this initial pass, or a valid date string
  in `"YYYY-MM-DD"` format, such as `"2026-01-01"`. Its local midnight in
  `timezone` must not be in the future when processing runs.
- **Example default:** `null`.
- An unfinished initial pass starts immediately when the worker starts, even
  outside a daily scheduled time. If the per-run limit leaves a backlog, later
  scheduled checks continue it. Live processing records its completion in the
  persistent state; dry-runs do not record completion.

### `max_messages_per_run`

The total number of pending emails that may be classified in one run, across all
retrieval batches.

- **Allowed values:** a whole number of at least `1`, or `null` for all pending
  matches in the selected time window.
- **Example default:** `5`, a small starting limit for trying the workflow.
- A larger limit increases the possible run duration. Make sure the limit and
  schedule can keep up with incoming mail before messages leave the lookback
  window.

### `batch_size`

How many emails to retrieve, classify, and label in each batch. This limits
the number of bodies held in memory at once; it does not change the total
per-run limit. Each email gets its own model request. With `--apply`, successful
label additions and valid no-label results are saved as completed before the
next batch is fetched. Dry-runs preview each batch without marking completion.

- **Allowed values:** a whole number from `1` to `500`, inclusive.
- **Example default:** `5`.
- For example, with `max_messages_per_run` set to `12` and `batch_size` set to
  `5`, a full run classifies and labels 5 emails, then 5 more, then the final 2.
  If a later batch fails, earlier successful batches remain completed and are
  skipped on subsequent runs using the same state.

Unloading the model after every retrieval batch would increase total runtime,
because the model would need to load back into memory for the next batch. The
automatic worker keeps it loaded across retrieval batches within a run. If
`unload_after_batch` is enabled in the model settings, it requests unloading once
when the run exits after its batch classification and labeling, including on
failure if inference was attempted. Labeling a batch does not explicitly unload
the model; Ollama's configured `keep_alive` still governs idle time between requests.

These settings do not authorize Gmail changes. The automatic worker uses a
dry-run by default; its `--apply` option enables label additions and persistent
completion records. Restart a running worker after changing its configuration,
because settings are read at startup.

## `gmail.example.json` — Gmail connection settings

This file tells Python and Gmail MCP where to find authentication files inside
the container and how long a Gmail session may take. It contains paths, not the
actual credentials. Keep all three keys; extra keys and comments are not
supported.

### `oauth_path`

The location of the Google OAuth client configuration downloaded from Google
Cloud. This identifies the application during authorization.

- **Allowed values:** a non-empty absolute file path inside the container.
- **Example default:** `"/run/gmail/gcp-oauth.keys.json"`.

### `credentials_path`

The location of the saved authorization tokens generated after signing in and
granting Gmail access through Gmail MCP. These allow subsequent runs to access
the mailbox without asking the user to sign in each time, while authorization
remains valid.

- **Allowed values:** a non-empty absolute file path inside the container.
- **Example default:** `"/run/gmail/credentials.json"`.
- In vault mode, both `oauth_path` and `credentials_path` are replaced at runtime
  with owner-only files under the container's `/tmp`; keep the defaults here.
- Use the token file generated by Gmail MCP; a token file from a separate Python
  Gmail integration is not interchangeable.

### `timeout_seconds`

The maximum time allowed for each Gmail MCP session, including MCP startup and
the operations performed during that session. Several operations in one session
share this time budget. Each new session gets a fresh budget.

- **Allowed values:** a positive, finite number of seconds, such as `90` or
  `180`. Fractional values are also accepted. Zero, negative numbers, and `null`
  are not accepted.
- **Example default:** `90` seconds.
- This is a time limit, not a pause between emails or scheduled checks. The same
  value is also passed to the MCP server as its timeout in milliseconds.
- Slow connections or a large label-application pass may need a higher value.
  Ollama inference uses a separate timeout in the model settings.
- A timeout during label application does not undo changes already made in
  Gmail. Inspect Gmail and the logs before retrying an interrupted write.

## `.env` — local Docker settings

The `.env.example` file is a shared template. Each user creates their own `.env`
in the repository root, beside `compose.yaml`. Docker Compose reads it when
commands are run from that directory.

To create it without overwriting an existing `.env`, run this from the repository
root:

```sh
cp -n .env.example .env
```

`cp` copies the template; `-n` preserves any existing destination file. This only
creates a local settings file and does not authenticate with Gmail or start a
container. Edit the resulting `.env` in your editor.

### `GMAIL_MCP_DIR`

Set this to the absolute path of your private Gmail credential folder on the
Linux computer running Docker. It must already contain your own
`gcp-oauth.keys.json` and `credentials.json`, obtained through Google Cloud setup
and Gmail MCP authorization.

Only file mode reads this setting: `compose.credentials-files.yaml` mounts that
folder read-only at `/run/gmail` inside the container. In vault mode
(`compose.credentials-vault.yaml`), the two files come from the
`GMAIL_OAUTH_KEYS_JSON` and `GMAIL_CREDENTIALS_JSON` secrets instead and this
setting is not needed; see
[vault mode](SETUP.md#optional-keep-the-oauth-files-in-your-vault). For example:

```text
Host: /private/gmail/gcp-oauth.keys.json → Container: /run/gmail/gcp-oauth.keys.json
Host: /private/gmail/credentials.json    → Container: /run/gmail/credentials.json
```

For that example, set `GMAIL_MCP_DIR=/private/gmail` in `.env`. The two paths in
`gmail.example.json` can stay unchanged. Normally, only the host folder setting
needs to change for a different user's credential location; the actual files
must still be created through authorization.

### `MAILSORT_UID` and `MAILSORT_GID`

Set these in the same `.env` file. They select the numeric Linux user and group
that run the container when a supplied Gmail Compose override is used. This
lets the application access private mounted files with that user's permissions;
it does not change file ownership or grant additional permissions.

On the Linux computer running Docker, run these as the user who owns the
credential folder:

```sh
id -u
id -g
```

`id -u` prints your numeric user ID; `id -g` prints your primary numeric group ID.
These commands only display information and do not change your system. Copy
their outputs into `.env`; for example, if both print `1000`:

```dotenv
GMAIL_MCP_DIR=/absolute/path/to/your/private/gmail-mcp
MAILSORT_UID=1000
MAILSORT_GID=1000
```

Replace the example path and IDs with your own values. Enter the actual numbers:
`.env` does not execute commands such as `id -u` or shell command substitutions.
The private `.env` and credential files are excluded from Git by the repository's
ignore rules; the shared `.env.example` remains suitable for the public repo.

### macOS and Windows — possible setup options (untested)

**These macOS and Windows options have not been tested with this project.** The
current deployment instructions target Linux. The suggestions below are starting
points, not a verified installation guide or a guarantee that the full workflow
works unchanged.

The application uses a Linux container on these platforms too. The credential
paths inside it can remain `/run/gmail/gcp-oauth.keys.json` and
`/run/gmail/credentials.json`. The host folder path and permission handling differ.

#### macOS with Docker Desktop

- Use Docker Desktop with Linux containers. Set `GMAIL_MCP_DIR` to an existing
  Mac folder, such as `/Users/your-name/private/gmail-mcp`, containing your own
  authentication files. Allow Docker Desktop to access that folder if prompted.
- The `id -u` and `id -g` commands above also work in macOS Terminal: they only
  print the current user's numeric IDs. You can enter those values in `.env`.
  Docker Desktop translates permissions for Mac-mounted folders, so matching
  host and container IDs is generally unnecessary. The supplied Gmail Compose
  overrides still require both variables to be set.
- Check that the container can read the credential files and write to the
  mounted runtime folders before relying on automatic processing.

#### Windows with WSL 2 and Docker Desktop

- One possible approach is Docker Desktop's WSL 2 backend with integration
  enabled for a Linux distribution, such as Ubuntu. Run the setup and Compose
  commands from that distribution's terminal.
- Keep the repository, credentials, and runtime folders in the WSL Linux
  filesystem for this approach. Set `GMAIL_MCP_DIR` to the credential folder's
  absolute Linux path, such as `/home/your-name/private/gmail-mcp`.
- Run `id -u` and `id -g` in that WSL terminal and copy the printed numbers into
  `.env`. These identify the WSL Linux user and group, not the Windows account.
  Matching ownership matters for files in the WSL Linux filesystem.
- WSL integration does not by itself verify the project's Ollama networking or
  OAuth callback setup; those still need to be checked in that environment.

See [Docker's WSL 2 setup guide](https://docs.docker.com/desktop/features/wsl/).

#### Windows with PowerShell and Docker Desktop

- Use Linux containers. Create `.env` from `.env.example` in your editor and set
  `GMAIL_MCP_DIR` to your existing Windows credential folder. An example path
  using forward slashes is `C:/Users/your-name/private/gmail-mcp`.
- `id -u` and `id -g` are not standard PowerShell commands. Windows accounts do
  not have Linux UID/GID numbers to copy into these settings.
- Values such as `MAILSORT_UID=1000` and `MAILSORT_GID=1000` can be tried as
  non-root container IDs. They identify the process inside the Linux container,
  not the Windows user. Docker Desktop handles access to Windows-mounted
  folders through the Windows user's permissions. Verify credential reads and
  runtime writes rather than assuming these example IDs prove access.
- Linux shell commands elsewhere in the guide may need PowerShell equivalents.

See [Microsoft's explanation of Docker mount permissions across platforms](https://code.visualstudio.com/remote/advancedcontainers/add-nonroot-user).

#### Connecting to Ollama on Docker Desktop

The supplied Ollama and processing Compose overrides use `network_mode: host`.
Docker Desktop supports host networking from version 4.34 onward, but it must
be explicitly enabled in Settings → Resources → Network. This changes Docker
Desktop's networking settings; it is not enabled by this repository.

This is a possible way to use the existing overrides on Mac or Windows, but it
has not been tested here. Verify both Ollama connectivity and Gmail authorization
before attempting live labeling. See [Docker's host networking requirements and
limitations](https://docs.docker.com/engine/network/drivers/host/).

## `labels.example.json` — classification categories

This is the shared starting catalog for Promotions, Newsletters, Receipts &
Delivery, Appointments & Bookings, and Accounts & Security. Enabled label names,
descriptions, and applicable guidance become part of the model's prompt. Python
then validates the predictions and applies the configured thresholds and limit.
Editing this JSON alone does not create, rename, or apply Gmail labels.

| Setting | What it means and allowed values |
| --- | --- |
| `max_labels_per_email` | Whole number of at least `1`; the example uses `5`. If more labels qualify, the prediction is rejected rather than silently trimmed. |
| `labels` | A non-empty list of label definitions. Enable at least one before classification. |
| `id` | A unique, non-empty internal identifier, such as `work`. Imported entries use Gmail IDs, but label application resolves current Gmail labels by exact name. |
| `name` | A unique, non-empty, single-line label name. For Gmail application, it must exactly match a user-created Gmail label. |
| `description` | Text explaining which emails belong and which do not. Must be non-empty when the label is enabled. |
| `enabled` | `true` includes the label in classification; `false` leaves it out without deleting it from Gmail. |
| `threshold` | Number from `0` to `1`, inclusive; the example uses `0.50`. In `confidence` mode, a score must be at least this value. Ignored in `labels` mode. Model confidence is not a calibrated probability. |
| `guidance` | Optional groups of extra classification instructions. Each rule's `requires` lists catalog IDs; the rule is included only when all those labels are enabled. An empty `requires` list always qualifies. |

### Customize a private catalog

From the repository root on Linux, create a working copy:

```sh
cp -n config/labels.example.json config/labels.json
```

This copies the example into a Git-ignored personal file; `-n` preserves an
existing file. Edit descriptions, enable or disable entries, adjust thresholds,
or add your own entries with all five fields (`id`, `name`, `description`,
`enabled`, and `threshold`). Keep IDs and names unique. If removing or changing
IDs, update any guidance that references them. Custom catalogs may omit
`guidance` entirely.

Select the private catalog explicitly with `--labels user-config/labels.json`
when running a classification command inside Docker; otherwise commands that
default to the example continue using it. Restart a worker after edits.
Create any new custom Gmail labels manually with exactly matching names before
applying them to messages. Gmail's built-in Promotions category does not replace
a user-created label named `Promotions`.

### Create the five base labels in Gmail

After configuring Gmail authorization and building the application image, preview
which base labels exist and which would be created:

```sh
docker compose -f compose.yaml -f compose.credentials-files.yaml -f compose.gmail.yaml run --rm -T \
  --entrypoint python app -m noemi_mailsort.create_base_labels
```

The `-f` options select the base and Gmail Compose files. `--entrypoint python`
and `-m` run the Python setup module; `--rm` removes the temporary container and
`-T` disables terminal allocation. This preview reads Gmail label metadata and
makes no Gmail changes. To create the missing base labels after reviewing it:

```sh
docker compose -f compose.yaml -f compose.credentials-files.yaml -f compose.gmail.yaml run --rm -T \
  --entrypoint python app -m noemi_mailsort.create_base_labels --apply
```

`--apply` enables creation, requiring a suitable OAuth grant and the MCP
`create_label` tool. Existing user labels are kept. This command uses only the
shipped base catalog, has no custom `--labels` option, and does not classify or
label emails. It does not update the local catalog. Earlier creations may remain
if a later one fails; rerun the preview to inspect the result.

### Import existing Gmail labels into the app

Instead of copying the example, initialize a catalog from your account's labels:

```sh
docker compose -f compose.yaml -f compose.credentials-files.yaml -f compose.gmail.yaml run --rm -T \
  --entrypoint python --volume ./config:/app/user-config:rw app \
  -m noemi_mailsort.import_labels
```

This reads user-created label names and IDs and writes `config/labels.json` on
the host. The `--volume` option temporarily makes the config mount writable for
this import; credentials remain mounted read-only. The other Docker flags have
the same roles as above. It does not read emails or change Gmail.

Imported labels start with empty descriptions, `enabled: false`, and
`threshold: 0.50`, with no guidance. The initial `max_labels_per_email` equals the
number of imported user labels: importing 12 labels sets the limit to `12`.
This is calculated once during import; later catalog edits do not automatically
recalculate it. You can lower the saved limit manually. Add descriptions and
enable only the labels you want the model to use. System labels such as Inbox
and Sent are excluded. No file is created if there are no user labels.

Importing creates a new file rather than merging or synchronizing catalogs. It
refuses to overwrite an existing file or write to a shared `.example.json` file.
If `labels.json` already exists, append
`--output user-config/labels.imported.json` to the import command to create a
separate private file, then copy desired entries into your working catalog.

To check your edited catalog and preview the prompt offline on Linux:

```sh
docker compose run --rm -T --user "$(id -u):$(id -g)" app \
  --labels user-config/labels.json --mode labels
```

`--user` uses your host IDs so the private imported file is readable. `--labels`
selects your catalog and `--mode labels` selects labels-only output. This validates
the catalog and prints the prompt without contacting Gmail or Ollama. Expect only
enabled labels and applicable guidance to appear; no Gmail changes are made.

## `model.example.json` — Ollama and classification settings

Despite its name, this file is both a shared example and the active default for
the automatic worker, Gmail dry-run, and message-labeling commands. The standalone
`classify` command requires an explicit `--model-config` path. There is no hidden
personal model configuration that overrides these settings automatically.

Python loads the selected JSON, prepares the email and prompt, and calculates
the context allocation. It sends the model name, generation options, keep-alive
duration, and optional thinking setting to Ollama's `/api/chat` endpoint. Other
settings below control Python's own preparation, timeout, and cleanup behavior.
The calculated context replaces `options.num_ctx` in memory for the request;
the JSON file itself is not rewritten.

### Choose a private model configuration

From the repository root on Linux, create a working copy:

```sh
cp -n config/model.example.json config/model.json
```

This creates a Git-ignored personal configuration; `-n` preserves an existing
file. Edit the copy, then add `--model-config user-config/model.json` to the
classification command or worker command you use inside Docker. The base Compose
file mounts the host's `config` directory at `/app/user-config`.

Creating `model.json` alone does not select it. Without the explicit argument,
commands that default to the example continue using the example. Compose also
mounts `model.example.json` at its default image path, so edits to that default
file are visible without rebuilding. A running worker reads settings at startup:
restart it after edits. Keep shared defaults generic and personal changes in
the private copy.

### Main settings

The allowed values below describe this application's validation; a selected
model must also support the requested Ollama options.

| Setting | Purpose and allowed values | Example default |
| --- | --- | --- |
| `endpoint` | Ollama server origin: an HTTP(S) address, optionally with a port, without embedded credentials, query parameters, or an API path. Python appends `/api/chat` itself. The address must be reachable from the container. | `"http://127.0.0.1:11434"` |
| `model` | Non-empty name of an installed local Ollama model. The application does not download models and rejects cloud-backed models during its model check. | `"qwen3:8b"` |
| `timeout_seconds` | Positive, finite number of seconds used as the HTTP timeout for Ollama requests; separate from the Gmail session timeout. It is a limit, not a delay between emails. | `120` |
| `keep_alive` | Positive whole-number duration string with `ms`, `s`, `m`, or `h`, such as `"300s"`. Requests that Ollama keep the model loaded between requests; this app does not accept `0` here. | `"5m"` |
| `unload_after_batch` | `true` requests unloading when a classification run exits, including after an error if inference was attempted. `false` leaves unloading to Ollama's keep-alive behavior. In the automatic worker, a run includes all selected retrieval batches, so this does not unload after each group. | `true` |
| `body_max_characters` | Whole number of at least `1`. Keeps only this many characters from the start of each email body and reserves context for that maximum. Longer bodies are truncated. | `1000` |
| `context_safety_tokens` | Whole number of at least `1`. Extra headroom in the context budget. | `256` |
| `think` | `true` requests thinking output, `false` requests it disabled, and `null` omits the setting so the model default applies. Support depends on the model. | `false` |

The localhost endpoint is intended for the supplied Linux host-network setup.
Other container-network arrangements may need a different endpoint. See the
untested macOS and Windows options above.

### `options` — generation settings

These options go to Ollama, with the calculated context substituted for
`num_ctx`. The limits listed here are enforced by this app.

| Key | Purpose and allowed values | Example default |
| --- | --- | --- |
| `temperature` | Controls sampling randomness. A finite number of at least `0`; lower values favor more consistent output. | `0` |
| `seed` | Random seed used during generation; any integer. Helps repeatability, but does not guarantee identical results across different models or environments. | `42` |
| `top_k` | Limits sampling to the most likely next-token candidates; a whole number of at least `1`. | `1` |
| `top_p` | Limits sampling by cumulative probability; a number from `0` to `1`, inclusive. | `1` |
| `repeat_penalty` | Repetition penalty; a positive, finite number. `1` leaves repetition unpenalized. | `1` |
| `num_ctx` | Maximum context allocation permitted by this app, as a whole number of at least `1`. It must leave sufficient room for input, output, and safety margins. The actual request uses the calculated allocation below. | `40960` |
| `num_predict` | Maximum generated output tokens; a whole number of at least `1`. Also reserved in the context budget. | `512` |

See Ollama's [generation parameter reference](https://docs.ollama.com/modelfile#valid-parameters-and-values)
and [chat request reference](https://docs.ollama.com/api/chat).

### Dynamic context allocation (`num_ctx`)

The context window is the space available for the model's input and output.
This repository already calculates an allocation automatically once per
classification run. It uses the selected prompt mode, enabled label descriptions
and guidance, response schema, maximum email-body length, output allowance,
and safety margins. All emails and retrieval groups in that run use the same
allocation; shorter individual bodies do not reduce it.

The calculation is a conservative estimate rather than exact tokenizer counting:
it counts prompt/schema UTF-8 bytes as budget slots, reserves four slots per
body character, adds 1,024 slots for headers/email JSON and 1,024 for message
formatting, then adds `num_predict` and `context_safety_tokens`. It chooses the
next strictly larger multiple of 4,096.

With the shared five-label catalog in confidence mode:

| `body_max_characters` | Calculated request `num_ctx` | Configured ceiling |
| --- | --- | --- |
| `1000` | `16384` | `40960` |
| `2000` | `20480` | `40960` |

Changing the label catalog or prompts can change those results. Exceeding the
configured ceiling raises an error rather than silently shrinking the budget.
The selected allocation is checked against the model's advertised context limit
when available; prepared inputs, returned token counts, and incomplete responses
also receive checks. Larger selected allocations can increase memory use.

To preview a private configuration's allocation without contacting Gmail or
Ollama, after building the application image:

```sh
docker compose run --rm -T --entrypoint python app \
  -m noemi_mailsort.automatic --check-config \
  --model-config user-config/model.json --mode confidence
```

`--entrypoint python` and `-m` run the automatic module. `--check-config` validates
local settings and prompts and prints the calculated `num_ctx`; it does not
verify a live connection or installed model. `--model-config` selects the private
model file, and `--mode confidence` selects confidence output. This uses the
shared label catalog unless you also add `--labels user-config/labels.json`.
`--rm` removes the temporary container and `-T` disables terminal allocation.
No emails are classified, Gmail labels changed, or completion records written.

Other smaller models may produce different classification results, lower
accuracy, less reliable structured output, or poorly calibrated confidence
scores. Users should test their selected model and adjust confidence thresholds
accordingly.

### Resource use and classification speed

Local LLM inference can use substantial CPU/GPU capacity and RAM/VRAM. On a
personal computer, expect potentially higher temperatures, fan noise, power use,
and reduced responsiveness while classification runs. A dedicated server can
keep regular processing off your everyday computer, but is not inherently faster;
its hardware and configuration still determine performance.

- **Hardware and model:** CPU/GPU capability, available memory, model size, and
  quantization (how compactly model weights are stored) can greatly affect speed.
  If memory is insufficient, swapping to disk or moving work from GPU to CPU can
  slow inference substantially. Smaller models may be faster but change results.
- **Truncation:** `body_max_characters` limits the email-body prefix sent to the
  model. A lower limit reduces input processing and may reduce the calculated
  context allocation, but can remove information needed for accurate labeling.
- **Context and output:** Larger allocated contexts need more memory and can
  reduce performance, especially if the model no longer fits in GPU memory.
  `options.num_ctx` is only the application's ceiling; raising it alone does not
  increase the calculated allocation. Longer prompts and more generated output
  also add work. See [Ollama's context guide](https://docs.ollama.com/context-length).
- **Workload and scheduling:** More messages take longer overall. Use small run
  limits and schedule automatic processing during idle periods, leaving the
  computer powered on and awake. A smaller retrieval `batch_size` alone does not
  reduce the total number of messages selected for a run.

Inference runs in the separate Ollama process/service. Limiting only the Python
application container's CPU or memory does not cap Ollama's resource use. Test a
small representative batch on your own hardware before choosing run limits and
schedules; processing times from another computer are not a reliable estimate.

## `examples/emails.example.json` — smoke-test input

Two fictional emails (a receipt and a newsletter) let users try classification
before connecting Gmail. The `compose.ollama.yaml` workflow uses them to check
model connectivity, prompt generation, and prediction parsing and validation.
It prints results for manual inspection; it does not automatically check that
the expected categories were chosen. It accesses Ollama, but does not access or
modify Gmail.

## Persistent CSV logging

Automatic processing and manual `label_messages` runs (including plan creation
and previews) now append to `data/results.csv` through the existing
`/app/state` mount. History survives container replacement. Rows include UTC
timestamps, source, model, mode, dry-run flag, message ID, prediction, selected
and acknowledged applied labels, status, and errors. Previews do not claim
applied labels; uncertain Gmail writes are marked `outcome_unknown`.

Use `--results-file /app/state/another-results.csv` with either command to choose
a different file; the parent folder must exist and be writable. Without this
argument, automatic processing uses `--state-dir/results.csv`, and manual labeling
uses the directory in `MAILSORT_STATE_DIR` (or `/app/state`). CSV output is
separate from `processing.json`, which still handles completion tracking.

The standalone `dry_run` and local example `classify` commands do not write CSV
results. Neither do `--check-config` or `--count-only`. No Gmail, model, label,
or automatic JSON settings need to change to enable the default logging.

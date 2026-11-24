# How prompts are assembled

Python builds each prompt in this order:

1. **Shared instructions** from `classification_instructions.txt`.
2. **Enabled label names, descriptions, and applicable guidance**, generated
   from the selected labels JSON and inserted at `{{label_catalog}}`, currently
   at the end of the shared instructions.
3. **Output instructions** selected by the command's mode:
   - `--mode labels` appends `label_prediction.txt`, requesting predicted label names.
   - `--mode confidence` appends `confidence_scoring.txt`, requesting a score for
     every enabled label.

Both modes use the same category definitions and classification instructions.
To customize categories, edit your private labels JSON; no separate category
text file is needed. Python enforces the maximum accepted label count and, in
confidence mode, each label's threshold after validating the model response.

## Choose a mode and configure thresholds

In this project's testing, **confidence scoring produced better
classification results** than label prediction, but it was usually
slower. Results and completion times may differ with your model, mailbox, and
configuration. Select `--mode confidence` to use scoring, or `--mode labels` for
labels-only prediction; the label JSON does not select the mode.

Edit your private **`config/labels.json`** catalog, created by copying the
[example catalog](../config/labels.example.json) or importing Gmail labels:

- Set a label's `enabled` field to `true` to include it, or `false` to exclude it.
  Enabled labels also need a non-empty `description`.
- Set its `threshold` to a number from `0` to `1`; the starting value is `0.50`.
  In confidence mode, a label qualifies when its score is at least its threshold.
  Thresholds are ignored in labels-only mode.

Select this private file with `--labels user-config/labels.json` when running in
Docker. If you use another catalog filename, edit and select that file instead.
Changing enabled labels, descriptions, or thresholds can influence the accepted
results. Higher thresholds filter out more low-scoring predictions; lower ones
accept more. Model confidence is not a calibrated probability, so test changes
with a small dry-run before applying labels.

## Use your own prompt wording

The original prompts were tested, so we recommend starting with them. Feel free
to fine-tune your own copies and try them in a dry-run before applying labels.
The results from the original prompts do not establish how modified wording
will perform.

Create a `prompts/local/` folder and copy all three original TXT files into it,
keeping their names:

```text
prompts/local/
├── classification_instructions.txt
├── label_prediction.txt
└── confidence_scoring.txt
```

Edit whichever copies you want to customize. Keep exactly one
`{{label_catalog}}` placeholder in `classification_instructions.txt`, and retain
the selected mode's JSON response format. The custom folder supplies the
templates; files are not merged with the originals. `prompts/local/` is already
Git-ignored, so your personal templates stay outside the public repository.

After building the image and preparing `config/labels.json`, preview your custom
prompt from the repository root. Imported catalogs are owner-only files, so run
the preview as the same user/group that owns them rather than the image's default
user. These commands do not change file permissions.

**Linux/macOS:**

```sh
docker compose run --rm -T --user "$(id -u):$(id -g)" --volume ./prompts/local:/app/local-prompts:ro app --labels user-config/labels.json --mode labels --prompt-dir /app/local-prompts
```

`id -u` and `id -g` supply your current numeric user/group IDs, as used during
setup. On Linux/WSL, these should match the owner of the imported catalog.

**Windows PowerShell:**

```powershell
$mailsortContainerUser = '1000:1000'
docker compose run --rm -T --user $mailsortContainerUser --volume ./prompts/local:/app/local-prompts:ro app --labels user-config/labels.json --mode labels --prompt-dir /app/local-prompts
```

Replace `1000:1000` if your `.env` uses different `MAILSORT_UID:MAILSORT_GID`
values. These select the Linux container user, not a Windows account; Docker
Desktop still needs access to the mounted folders. Windows/macOS instructions
remain untested end to end, as noted in the setup guide.

`--user` overrides the image's default user for this one container.
`--volume` mounts your custom folder read-only (`:ro`) inside Docker.
`--prompt-dir` selects that container path, `--labels` selects your private
catalog, and `--mode labels` appends the custom `label_prediction.txt`. Use
`--mode confidence` to append the custom `confidence_scoring.txt` instead.
`--rm` removes the temporary container and `-T` disables terminal allocation.
This prints the assembled prompt without contacting Gmail or Ollama or changing
files; it does not test classification quality.

The classification commands also accept `--prompt-dir`; include the custom
folder mount when running them in Docker. A new arbitrary TXT filename is not
automatically discovered, and a third output format would require code changes.

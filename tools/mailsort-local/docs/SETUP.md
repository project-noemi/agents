# Setup guide

This guide takes you from the downloaded project to a small Gmail classification
dry-run. Start in the repository folder described in the
[README](../README.md#getting-started). Skip installation steps for software you
already have working.

The deployment uses Linux containers. Linux is the current target environment;
the Windows and macOS instructions are based on the tools' official documentation
and have **not been tested end to end with this project**.

Choose the section for your platform. Linux examples use Bash, macOS examples
work in Terminal's default zsh or Bash, and Windows examples use PowerShell.
Commands marked **all platforms** are single-line commands that work in all
three shells. Run each command separately and resolve errors before continuing.
Installation commands below install software on your computer; application
dependencies remain inside the Docker image.

## 1. Install Docker and Docker Compose

### Linux: Ubuntu

These commands are for a supported Ubuntu release on a computer without an
existing conflicting Docker installation. For Debian, Fedora, other distributions,
or an existing installation, follow the appropriate
[Docker Engine installation guide](https://docs.docker.com/engine/install/).
Do not run Ubuntu repository commands on another distribution.

First install the download tools and register Docker's package signing key:

```sh
sudo apt update
sudo apt install ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
```

`sudo` requests administrator privileges. These commands update package metadata,
install HTTPS certificate/download support, and save Docker's public signing key
so Apt can verify its packages. `curl -fsSL` reports download failures and follows
redirects; `-o` selects the destination file.

Add Docker's official Apt repository:

```sh
sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

The block ending in `EOF` writes a system package source using your Ubuntu release
and CPU architecture. Apt then installs Docker Engine, its command-line tools,
the container runtime, Buildx, and the Compose plugin. Docker normally starts as
a system service. See the
[official Ubuntu instructions](https://docs.docker.com/engine/install/ubuntu/)
if installation or service startup fails.

The remaining examples assume your user can run Docker without `sudo`. If you
receive a Docker socket permission error, one option is:

```sh
sudo usermod -aG docker "$USER"
```

This adds your account to the Docker group; sign out and back in, including
reconnecting SSH sessions, before continuing. Membership grants control of the
Docker daemon and effectively root-level access. See Docker's
[post-installation guidance](https://docs.docker.com/engine/install/linux-postinstall/)
for alternatives. This step is unnecessary if Docker already works for your user.

### macOS

Download the Docker Desktop installer for **one** architecture:

```sh
# Apple Silicon (M-series)
curl -fL https://desktop.docker.com/mac/main/arm64/Docker.dmg -o "$HOME/Downloads/Docker.dmg"
```

```sh
# Intel
curl -fL https://desktop.docker.com/mac/main/amd64/Docker.dmg -o "$HOME/Downloads/Docker.dmg"
```

The selected command downloads Docker Desktop to your Downloads folder, replacing
an installer of the same name. `-fL` reports HTTP failures and follows redirects.
Mount the downloaded disk image, run its installer, and unmount it:

```sh
sudo hdiutil attach "$HOME/Downloads/Docker.dmg"
sudo /Volumes/Docker/Docker.app/Contents/MacOS/install
sudo hdiutil detach /Volumes/Docker
open -a Docker
```

These commands install Docker Desktop in Applications and launch it. Complete
the first-run prompts and wait until the engine is running. Docker Desktop
includes Compose. Check the
[official macOS installation guide](https://docs.docker.com/desktop/setup/install/mac-install/)
for supported macOS versions and installation alternatives.

### Windows: PowerShell

Use Docker Desktop's **WSL 2 backend** and **Linux containers**. If WSL is not
installed, run this in an administrator PowerShell window:

```powershell
wsl --install
```

This enables WSL and installs its default Linux distribution. Restart if prompted
and complete any distribution setup. If WSL already exists, use `wsl --update`
instead to update it. See the
[official Windows installation guide](https://docs.docker.com/desktop/setup/install/windows-install/)
for supported Windows versions and virtualization requirements.

On an **Intel/AMD Windows computer**, download and start the Docker installer:

```powershell
Invoke-WebRequest -Uri 'https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe' -OutFile "$env:TEMP\DockerDesktopInstaller.exe"
Start-Process -FilePath "$env:TEMP\DockerDesktopInstaller.exe" -ArgumentList 'install', '--backend=wsl-2' -Wait
```

The first command saves the installer in your temporary folder, replacing a file
of the same name. The second installs Docker Desktop, requesting elevation if
needed; `-Wait` keeps the terminal waiting until installation finishes. On Windows
ARM, choose the appropriate download from Docker's official guide instead.
Open Docker Desktop from the Start menu, complete its prompts, and wait until it
is running. Reopen PowerShell if the `docker` command is not found.

The remaining Windows examples run in **PowerShell**, with the repository and
credentials stored on Windows. If you instead choose a WSL terminal, enable Docker
Desktop's WSL integration and use the Linux shell examples consistently, with
files in the WSL Linux filesystem. Do not mix PowerShell variables and Windows
paths with Bash variables and WSL paths. Ollama connectivity and the OAuth browser
callback still need verification in either arrangement. See
[Docker's WSL documentation](https://docs.docker.com/desktop/features/wsl/).

### Docker Desktop: enable host networking

On macOS and Windows, use Docker Desktop **4.34 or later**. In Docker Desktop,
open **Settings → Resources → Network**, enable **host networking**, and apply
the change. This may restart Docker Desktop and affect running containers.
This feature is required by the supplied Ollama/processing configurations and
the authentication command below; simply selecting Linux containers is not enough.
It is incompatible with Enhanced Container Isolation. See
[Docker's host networking documentation](https://docs.docker.com/engine/network/drivers/host/).

### Verify Docker — all platforms

```sh
docker version
docker compose version
docker run --rm hello-world
```

The first two commands print the client/server and Compose versions. Both Docker
client and server details should appear. The last downloads a small verification
image if necessary, prints a success message, and removes the finished container
(`--rm`). Its image remains in Docker's cache.

## 2. Install Ollama and download a local model

For these instructions, run Ollama on the same computer as Docker. On macOS,
installing Ollama directly on the Mac also allows Ollama to use Apple Silicon
acceleration independently of the application container.

**Qwen3 8B (`qwen3:8b`) is the recommended starting model** because it offered
the best balance of classification results and completion time in this project's
benchmarks among the tested models and configurations.

The default quantized version (Q4_K_M) takes approximately **5.2 GB on disk**;
allow additional space for Ollama, Docker images, and runtime files. See the
[Ollama model listing](https://ollama.com/library/qwen3:8b).

For CPU-only inference, budget approximately **8–10 GB of available RAM** as a
minimum planning estimate for modest context sizes. **16 GB of total system RAM
is recommended** to leave room for the operating system, Docker, and other
applications. This is an estimate, not a measured minimum for every machine;
the actual requirement depends on context size, runtime settings, and GPU
offloading. Larger contexts need more memory, as explained in
[Ollama's context-length guide](https://docs.ollama.com/context-length).

### Linux

```sh
curl -fsSL https://ollama.com/install.sh -o /tmp/noemi-ollama-install.sh
sh /tmp/noemi-ollama-install.sh
```

The first command downloads Ollama's official installer to a temporary file;
you can inspect it before running the second command. The script installs Ollama
and may request administrator privileges and configure a background service.
See the [Linux installation guide](https://docs.ollama.com/linux).

### macOS

```sh
curl -fL https://ollama.com/download/Ollama.dmg -o "$HOME/Downloads/Ollama.dmg"
open "$HOME/Downloads/Ollama.dmg"
```

These commands download and open the installer, replacing a previous downloaded
installer of the same name. Drag Ollama to Applications, launch it, and complete
the prompt to make its command-line tool available. Ollama should remain running
while you use Mailsort. See the [macOS installation guide](https://docs.ollama.com/macos).

### Windows: PowerShell

```powershell
Invoke-WebRequest -Uri 'https://ollama.com/download/OllamaSetup.exe' -OutFile "$env:TEMP\OllamaSetup.exe"
Start-Process -FilePath "$env:TEMP\OllamaSetup.exe" -Wait
```

These commands download and launch the installer, replacing a previous installer
in the temporary folder. Complete its prompts and reopen PowerShell so the new
`ollama` command is on your PATH. Ollama normally runs in the background after
installation. See the [Windows installation guide](https://docs.ollama.com/windows).

### Download the model — all platforms

Make sure Ollama is running first. Start the Ollama desktop app on macOS/Windows
or start its installed service on Linux. For a foreground server, `ollama serve`
starts the API and keeps that terminal occupied until Ctrl+C; run the following
commands in a second terminal. Do not start a second server if one is already
listening.

```sh
ollama --version
ollama pull qwen3:8b
ollama list
```

These commands show the installed version, download the model used by the example
configuration, and list locally available models. The download uses the disk
space described above; `qwen3:8b` should appear in the list when it finishes.

The default endpoint is `http://127.0.0.1:11434`. Keep it private; no public port
or firewall change is needed. Use a downloaded **local** model, rather than an
Ollama cloud model, to keep classification on your infrastructure.

> Other smaller models may produce different classification results, lower
> accuracy, less reliable structured output, or poorly calibrated confidence
> scores. Users should test their selected model and adjust confidence thresholds
> accordingly.

## 3. Build the application and check Ollama connectivity

From the repository root, run these commands on **all platforms**:

```sh
docker compose build app
docker compose run --rm -T app
```

The build downloads the pinned base images and installs Python, Node.js,
`@klodr/gmail-mcp` and the Python MCP SDK **inside the image**. It creates the
local image `noemi-mailsort-agent:local`. No host Python or Node installation is
needed. The second command prints the default classification prompt offline;
`-T` disables terminal allocation. Expect the five default categories to appear.

Check whether the application container can reach Ollama:

```sh
docker compose -f compose.yaml -f compose.ollama.yaml run --rm -T --entrypoint python app -c "import json, urllib.request; print([m['name'] for m in json.load(urllib.request.urlopen('http://127.0.0.1:11434/api/tags', timeout=10))['models']])"
```

This **all-platform** command selects the base Compose file and host-network
override with the two `-f` arguments. It requests Ollama's local model list from
inside the container, without running inference or accessing Gmail. Expect
`qwen3:8b` in the output. A refusal or timeout means you should check that Ollama
is running and, on Docker Desktop, that host networking is enabled.

To verify classification using only the supplied fictional emails:

```sh
docker compose -f compose.yaml -f compose.ollama.yaml run --rm -T app
```

This calls the local model using the shared example settings and prints validated
predictions. It may take time and use substantial RAM/VRAM. It does not access
Gmail. Finish this check before moving on to account authentication.

## 4. Create a Google OAuth client

This step uses a browser on any platform. Each installation uses its own client
and account authorization; credentials are never included in the application image.

1. Open [Google Cloud Console](https://console.cloud.google.com/), and create or
   select a project.
2. Enable the [Gmail API](https://console.cloud.google.com/apis/library/gmail.googleapis.com)
   for that project.
3. In **Google Auth Platform → Branding**, configure the application name and
   contact information. For a personal Gmail account, choose **External** under
   **Audience** and add your Gmail account as a **Test user** while the application
   is in Testing. Workspace policies may restrict access or allow Internal apps.
4. Under **Data Access**, add
   `https://www.googleapis.com/auth/gmail.modify`. This permits message reading
   and labeling. For a read-only experiment, use `gmail.readonly` instead and
   change the authentication command's scope accordingly; label creation and
   applying labels to messages then remain unavailable.
5. Under **Clients**, create an OAuth client of type **Desktop app** and download
   its JSON configuration. Keep track of its downloaded location for the next step.

Google describes these steps in its
[Gmail quickstart](https://developers.google.com/workspace/gmail/api/quickstart/python#authorize_credentials_for_a_desktop_application)
and [OAuth consent guide](https://developers.google.com/workspace/guides/configure-oauth-consent).
Only follow their Cloud configuration instructions here; Mailsort already
includes its own client libraries and authentication command. The
[`gmail.modify` scope](https://developers.google.com/workspace/gmail/api/auth/scopes)
grants broader Gmail capabilities than Mailsort uses; Python restricts the
operations actually called by the application.

## 5. Prepare private credentials and runtime folders

Keep the terminal used below open through authentication. Replace the downloaded
client filename in the copy command with your actual filename. These commands
preserve existing files; on a new installation the credential folder initially
contains only `gcp-oauth.keys.json`.

### Linux and macOS

```sh
mailsort_credential_dir="$HOME/.config/noemi-mailsort/gmail-mcp"
mailsort_container_user="$(id -u):$(id -g)"
mkdir -p "$mailsort_credential_dir" data private/review
chmod 700 "$mailsort_credential_dir" data private private/review
cp -n "$HOME/Downloads/downloaded-client.json" "$mailsort_credential_dir/gcp-oauth.keys.json"
chmod 600 "$mailsort_credential_dir/gcp-oauth.keys.json"
cp -n .env.example .env
```

The variables hold your private absolute credential path and numeric user/group
IDs. The commands create storage folders, restrict access to their owner, and copy
the client JSON and environment template without overwriting existing files
(`cp -n`). Runtime folders stay under the repository; credentials stay outside it.
On Docker Desktop, file access is mediated by Desktop, so verify it below rather
than assuming matching IDs alone guarantee access.

Display the values to enter in `.env`:

```sh
printf 'GMAIL_MCP_DIR=%s\nMAILSORT_UID=%s\nMAILSORT_GID=%s\n' "$mailsort_credential_dir" "$(id -u)" "$(id -g)"
```

This prints the path and IDs, not credentials. Open `.env` in your editor and
replace the corresponding template values with this output.

### Windows: PowerShell

```powershell
$mailsortCredentialDir = Join-Path $env:LOCALAPPDATA 'NoemiMailsort\gmail-mcp'
$mailsortContainerUser = '1000:1000'
New-Item -ItemType Directory -Force -Path $mailsortCredentialDir, 'data', 'private/review' | Out-Null
if (-not (Test-Path -LiteralPath "$mailsortCredentialDir\gcp-oauth.keys.json")) { Copy-Item -LiteralPath "$env:USERPROFILE\Downloads\downloaded-client.json" -Destination "$mailsortCredentialDir\gcp-oauth.keys.json" }
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env' }
```

These commands create the folders and preserve existing client/environment files.
The numeric IDs select a non-root user **inside the Linux container**, not your
Windows account. Docker Desktop mediates access to Windows folders. Restrict the
credential and runtime folders to your account using Windows folder security
settings, and allow Docker Desktop to access their locations if prompted.

Display the values for `.env`, using forward slashes in the host path:

```powershell
"GMAIL_MCP_DIR=$($mailsortCredentialDir.Replace('\', '/'))"
'MAILSORT_UID=1000'
'MAILSORT_GID=1000'
```

This prints settings without secrets. Open `.env` in your editor and replace its
template values with these values. The later file-access check must pass before
you rely on the example container IDs.

### Understand the mounts — all platforms

Docker Compose reads `.env` automatically from the repository root. It does not
execute shell expressions in it. If your path contains spaces, quote the path
value in `.env`. Previously exported environment variables with the same names
take precedence over `.env`; keep them consistent.

| Host location | Inside the application container | Purpose |
| --- | --- | --- |
| Credential folder from `.env` | `/run/gmail` | OAuth client and saved account tokens; normally read-only |
| Repository `config/` | `/app/user-config` | Private settings selected with command-line options |
| Repository `data/` | `/app/state` | Persistent processing state and CSV results in labeling/automatic workflows |
| Repository `private/review/` | `/app/review` | Review plans in the labeling workflow |

The supplied Gmail JSON settings already use `/run/gmail/gcp-oauth.keys.json` and
`/run/gmail/credentials.json`; leave those container paths unchanged. Private
configuration, `.env`, and runtime files are ignored by Git and excluded from
image builds. Keep them private when sharing logs or backups too.

## 6. Authorize Gmail through the bundled MCP server

No separate MCP installation or public server is needed. The application image
contains the [Gmail MCP server](https://github.com/klodr/gmail-mcp), which Python
starts through private input/output pipes during ordinary commands.

**If the browser is on another computer:** first run this in a terminal on the
browser computer (Linux/macOS Terminal or Windows PowerShell with OpenSSH):

```sh
ssh -N -o ExitOnForwardFailure=yes -L 127.0.0.1:3000:127.0.0.1:3000 YOUR_USER@YOUR_DOCKER_HOST
```

Replace the SSH destination. This forwards the browser computer's loopback port
3000 to the Docker host's loopback port 3000. `-N` opens no remote shell; the
session remains open until Ctrl+C. Keep it open during consent. Skip the tunnel
when the browser runs on the Docker host. No public callback port is needed.

Back in the terminal containing the variables from step 5, run the appropriate
authentication command. It refuses to proceed if `credentials.json` already
exists, preserving the existing account token.

### Linux and macOS

```sh
if [ -e "$mailsort_credential_dir/credentials.json" ]; then
  printf '%s\n' 'credentials.json already exists; use the connection check below or choose a new private credential folder.'
else
  docker run --rm --read-only --tmpfs /tmp --network host --user "$mailsort_container_user" --mount "type=bind,src=$mailsort_credential_dir,dst=/run/tokens" --mount "type=bind,src=$mailsort_credential_dir/gcp-oauth.keys.json,dst=/run/tokens/gcp-oauth.keys.json,readonly" --env GMAIL_OAUTH_PATH=/run/tokens/gcp-oauth.keys.json --env GMAIL_CREDENTIALS_PATH=/run/tokens/credentials.json --env GMAIL_MCP_STATE_DIR=/tmp/noemi-gmail-mcp --entrypoint gmail-mcp noemi-mailsort-agent:local auth http://127.0.0.1:3000/oauth2callback --scopes=gmail.modify
fi
```

### Windows: PowerShell

```powershell
if (Test-Path -LiteralPath "$mailsortCredentialDir\credentials.json") {
    Write-Output 'credentials.json already exists; use the connection check below or choose a new private credential folder.'
} else {
    docker run --rm --read-only --tmpfs /tmp --network host --user "$mailsortContainerUser" --mount "type=bind,src=$mailsortCredentialDir,dst=/run/tokens" --mount "type=bind,src=$mailsortCredentialDir/gcp-oauth.keys.json,dst=/run/tokens/gcp-oauth.keys.json,readonly" --env GMAIL_OAUTH_PATH=/run/tokens/gcp-oauth.keys.json --env GMAIL_CREDENTIALS_PATH=/run/tokens/credentials.json --env GMAIL_MCP_STATE_DIR=/tmp/noemi-gmail-mcp --entrypoint gmail-mcp noemi-mailsort-agent:local auth http://127.0.0.1:3000/oauth2callback --scopes=gmail.modify
}
```

Both commands start a temporary authentication container. `--entrypoint` selects
the MCP authentication tool, `--network host` makes its loopback callback
reachable, and `--user` controls which container user writes the token. The
credential directory is writable for this setup command; the client JSON has an
additional read-only mount. `--read-only` protects the container filesystem and
`--tmpfs /tmp` supplies temporary writable storage. `docker run` does not load
Compose's `.env`, which is why these commands use the terminal variables.

Open the printed Google authorization URL manually, select your intended Gmail
account, and approve access. A failure to launch a browser inside the container
is expected. Wait for terminal confirmation before continuing. Success creates
`credentials.json` alongside `gcp-oauth.keys.json`. Close the optional SSH tunnel
afterward. The account token is private; do not copy its contents into logs or Git.

If valid credentials for this MCP server already exist, use their matching client
and token files and skip new consent. Tokens from a different Python Gmail client
are not interchangeable. To renew expired consent, select a **new private folder**,
copy the matching client into it, update the step 5 variables and `.env`, and
repeat authentication. Keep existing files until the new connection is verified.

For an External OAuth app in **Testing**, Gmail refresh tokens expire after
seven days. A container restart does not renew consent. See
[Google's refresh-token rules](https://developers.google.com/identity/protocols/oauth2#expiration).
This matters for unattended use; publishing an app does not prevent other causes
of token expiration or revocation.

## 7. Verify credential access and Gmail connectivity

Run these commands on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T --entrypoint python app -c "from noemi_mailsort.gmail_mcp import load_gmail_config, check_credentials; from pathlib import Path; check_credentials(load_gmail_config(Path('config/gmail.example.json'))); print('Credential files are readable and valid')"
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T app
```

The first checks the mounted file formats and read access without displaying
secrets or contacting Gmail. The second connects to Gmail MCP and lists its tools
and your user-created labels. Expect a server version, tool names, and label
names/IDs. This check does not read messages or change Gmail. Treat its output as
private because your label names may contain personal information.

For permission failures, check `.env`, Docker Desktop's access to the host
folders, and Linux/WSL ownership where applicable. For `invalid_grant`, renew
consent as described above. If tools needed for labeling are missing, check that
the saved authorization includes `gmail.modify`.

## 8. Choose your label catalog

Choose **one** route. The application matches enabled catalog names to Gmail
user-created labels exactly, including case and spaces. Gmail's built-in
Promotions category does not replace a user-created `Promotions` label.

### Option A: use the five base labels

Preview which base labels are missing, on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T --entrypoint python app -m noemi_mailsort.create_base_labels
```

This lists existing or proposed labels without changing Gmail. After reviewing
the names, explicitly create missing labels:

```sh
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T --entrypoint python app -m noemi_mailsort.create_base_labels --apply
```

`--apply` creates missing **label definitions in Gmail**, skips existing ones,
and verifies the result. It does not label messages. The five names are Promotions,
Newsletters, Receipts & Delivery, Appointments & Bookings, and Accounts & Security.
The command requires write authorization and does not export arbitrary custom
catalogs. Use [example label configuration](../config/labels.example.json) for the following classification checks;
its descriptions are already populated.

### Option B: import your Gmail labels

Create the custom user labels you want in Gmail first, if needed. Then run this
on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T --entrypoint python --volume ./config:/app/user-config:rw app -m noemi_mailsort.import_labels
```

This reads label metadata and creates the private host file `config/labels.json`.
`--volume` temporarily makes the configuration mount writable; credentials remain
read-only. The importer refuses to overwrite an existing catalog. If one already
exists, add `--output user-config/labels.imported.json` to select a new file and
use that filename in subsequent commands. If there are no user labels, no catalog
is created. Imported labels start **disabled**, with empty descriptions and a
confidence threshold of `0.50`; `max_labels_per_email` initially equals the number
of imported labels.

Edit the new JSON in your editor: give each desired label a useful `description`
and set its `enabled` field to `true`. At least one label must be enabled for
classification, and enabled labels need non-empty descriptions. Keep the existing
field names and valid JSON syntax. Select the private catalog explicitly; its
filename alone does not activate it.

Verify the edited catalog on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.gmail.yaml run --rm -T --entrypoint python app -m noemi_mailsort.prompts --labels user-config/labels.json --mode labels
```

This uses the configured container user so imported private files are readable.
It prints the prompt offline; it does not connect to Gmail or Ollama. Expect only
your enabled categories and descriptions. The shared example remains unchanged.
Further catalog details are in the existing [configuration notes](CONFIG_NOTES.md#labelsexamplejson--classification-categories).

## 9. Prepare your first classification settings

For the base-label route, the defaults already select `qwen3:8b`, label prediction
mode, and a maximum of five messages from this query:

```text
newer_than:7d has:nouserlabels -in:sent -in:drafts
```

This selects recent messages without user-created labels, excluding sent mail
and drafts; it includes read and unread messages and is not limited to the inbox.
Start with a small limit. If no matching messages exist, a dry-run returns zero
messages without invoking the model.

To customize the model or search settings, make private copies first.

**Linux/macOS:**

```sh
cp -n config/model.example.json config/model.json
cp -n config/processing.example.json config/processing.json
```

**Windows PowerShell:**

```powershell
if (-not (Test-Path -LiteralPath 'config/model.json')) { Copy-Item -LiteralPath 'config/model.example.json' -Destination 'config/model.json' }
if (-not (Test-Path -LiteralPath 'config/processing.json')) { Copy-Item -LiteralPath 'config/processing.example.json' -Destination 'config/processing.json' }
```

These commands preserve existing private files. Edit them to select a downloaded
model, a reachable endpoint, or a different `query` and `max_messages`. All required
keys must remain present. For the first run, you may reduce `max_messages` to `1`.
The [configuration notes](CONFIG_NOTES.md) explain the supported settings.

When using private copies, append
`--model-config user-config/model.json --processing-config user-config/processing.json`
to the relevant command below. Use the same arguments consistently in later
workflows. Private files are mounted under `/app/user-config`, while most default
examples are bundled under `/app/config` at build time. Editing a host example
usually requires rebuilding; selecting a mounted private file avoids that.
The model example has an additional direct mount and is an exception.

## 10. Run a small Gmail dry-run

For the **base-label catalog**, run on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.dry-run.yaml run --rm -T app
```

For an **imported private catalog**, use:

```sh
docker compose -f compose.yaml -f compose.dry-run.yaml run --rm -T app --labels user-config/labels.json
```

These commands retrieve the bounded Gmail search and classify matching emails
with the local model. They print predictions, eligible labels, resolved Gmail
label IDs, and any mapping problems. Expect `dry_run: true`; no Gmail labels are
changed. Resolve missing label mappings and review classification quality before
enabling writes. To use confidence scoring with configured thresholds,
append `--mode confidence`; the default `--mode labels` uses label prediction without thresholds.

Use each Compose override with `compose.yaml` as shown. Do not stack all override
files together: they select different entrypoints and network configurations.

## 11. Verify persistent storage before using labeling workflows

Run on **all platforms**:

```sh
docker compose -f compose.yaml -f compose.labeling.yaml run --rm -T --entrypoint python app -c "import tempfile; [tempfile.TemporaryFile(dir=p).close() for p in ['/app/state', '/app/review']]; print('Runtime folders are writable')"
```

This creates and immediately removes a temporary file in each runtime folder to
check container write access. It does not contact Gmail or Ollama and does not
record messages as processed. A successful check is especially useful for Docker
Desktop's shared folders. If it fails, fix folder sharing/ownership before using
labeling or automatic processing.

Setup is complete when the connectivity checks, prompt preview, small Gmail
dry-run, and storage check pass. Continue to the [usage guide](USAGE.md) to apply
labels manually or enable automatic processing, manage the worker, and inspect
CSV results.

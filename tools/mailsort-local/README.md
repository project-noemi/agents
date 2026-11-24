# NoéMI Mailsort Agent

NoéMI Mailsort Agent is a self-hosted Python application that classifies Gmail messages and assigns labels using a locally running large language model. It is designed to run on your own computer or server, keeping email content on your own infrastructure during classification rather than sending it to an external LLM service.

The project grew out of my original [NoéMI MailSort agent idea](../../agents/communication/mailsort.md). I wanted to bring that idea to a standalone application using a local LLM instead of ChatGPT for privacy reasons.

This repository provides a general-purpose starting point with predefined labels and example configuration. Once the required setup is complete, you can use the included defaults. For better results, customize the labels, descriptions, and classification settings to match your mailbox and how you want to organize it. These settings can be changed without editing Python code.

## How It Works

The Python application retrieves Gmail messages through a Gmail MCP server and sends their content to a local model through Ollama. The model predicts suitable labels; Python validates the predictions, evaluates any configured confidence thresholds, and applies the accepted labels through Gmail MCP. The model is responsible only for classification, while Python controls Gmail operations.

You can run classification and labeling manually from the terminal, with an optional review step before applying labels, or use an automatic workflow that checks Gmail at configurable intervals or a daily scheduled time. Both workflows support previews without changing Gmail; applying labels must be explicitly enabled. The automatic worker classifies and labels each batch before fetching the next, saving successful progress as it goes.

Manual labeling and automatic workflows save results to a persistent CSV log and also write one structured JSON audit record per event to standard error, where Docker collects it in the container logs. The CSV log contains timestamps, message IDs, model predictions, selected and applied labels, processing status, and errors. This lets you review past processing without storing full email bodies in the log.

Gmail access requires an internet connection, but LLM inference runs locally. The application uses Docker Compose for deployment and does not require a graphical interface.

## Requirements

The application runs in Linux containers. The current setup instructions target Linux. Deployment on Windows or macOS through Docker Desktop is possible in principle, but the full workflow has not yet been tested with this project. Platform-specific networking, file paths, and permissions may need adjustments. On Windows, WSL 2 provides a Linux terminal for following the existing shell examples.

- **Docker with Docker Compose:** Docker Engine with the Compose plugin on Linux, or Docker Desktop running Linux containers on Windows or macOS. The supplied processing configurations use host networking; Docker Desktop requires version **4.34 or later** with [host networking enabled](https://docs.docker.com/engine/network/drivers/host/).
- **Ollama and a local model:** An Ollama server reachable from the application container, with the selected model already downloaded. The included configuration uses `qwen3:8b`.
- **Hardware resources:** Enough RAM and disk space for Docker, Ollama, and the selected model. GPU acceleration is optional; resource needs and processing speed depend on the model and its configuration.
- **Gmail access:** A Gmail account, a Google Cloud project with the Gmail API enabled, and OAuth credentials authorizing Gmail MCP to read messages and apply labels.
- **Label configuration:** A configured label catalog with descriptions and matching user-created labels in Gmail. You can use the five supplied base labels or import and customize your own Gmail labels.
- **Private persistent storage:** Folders for OAuth credentials, personal configuration, and processing state, with appropriate container read and write permissions.
- **Internet access:** Required for downloading dependencies and models during setup, and for accessing Gmail during operation. Classification uses the local model.

Python, Node.js, and the Gmail MCP server are included in the application image; separate host installations are not required.

Running a local LLM can use substantial CPU/GPU capacity and memory. On personal computers, classification may increase heat, fan noise, and power consumption, and make other applications less responsive. For frequent automatic processing, consider a dedicated server or schedule runs when your computer is otherwise idle. Speed depends on your hardware, model, and input/context settings; see the [performance notes](docs/CONFIG_NOTES.md#resource-use-and-classification-speed).

## Getting Started

This tool lives in the `tools/mailsort-local/` folder of the [Project NoéMI agents repository](https://github.com/project-noemi/agents); its agent specification is [`agents/communication/mailsort-local.md`](../../agents/communication/mailsort-local.md).

Install [Git](https://git-scm.com/downloads) if needed, then clone the repository and enter the tool's folder. These commands work in Linux/macOS terminals and Windows PowerShell:

```sh
git clone https://github.com/project-noemi/agents.git
cd agents/tools/mailsort-local
```

The first command downloads the repository, and the second opens this tool's folder in your terminal. In this tool's guides, "the repository root" means this `tools/mailsort-local` folder: run every command from here, and create your private `.env`, `config/`, `data/` and credential folders here. If you already have the repository locally, open its existing `tools/mailsort-local` folder instead.

Follow the [setup guide](docs/SETUP.md) to install Docker and Ollama, authorize Gmail access, prepare your labels, and verify classification with a small dry-run.

After setup, use the [usage guide](docs/USAGE.md) for manual labeling, optional review, automatic processing, worker management, and CSV results.

See the [configuration guide](docs/CONFIG_NOTES.md) for model, label, search, and scheduling settings, and the [prompt guide](docs/PROMPT_NOTES.md) for prompt modes, thresholds, and custom wording.

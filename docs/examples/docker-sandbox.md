# Docker AI Sandbox: Isolated Agent Environment

> Historical example: this Python-based sandbox is retained as an illustrative legacy reference. For the recommended current entry path, start with [`zero-to-first-agent.md`](zero-to-first-agent.md), then [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md), then [`docker-agent-home.md`](docker-agent-home.md).

This guide walks you through setting up a containerized AI agent environment using **Docker**, **PostgreSQL with pgvector**, and the **Gemini API**.

## Overview
When building agents, they usually need long-term memory to remember past interactions and a safe place to run. We accomplish this by pairing the agent with a vector database.

This setup creates a perfect isolated environment. It spins up a PostgreSQL database equipped with pgvector (the industry standard for AI memory) and a separate container for the agent's code.

---

## 🏗️ Architecture

The environment consists of two primary layers defined in `docker-compose.yml`:

### 1. The Memory Layer (`agent-memory`)
*   **Image:** `ankane/pgvector:latest`
*   **Purpose:** Where the agent stores embeddings and past conversations.
*   **Database:** PostgreSQL pre-loaded with vector search capabilities.

### 2. The Compute Layer (`agent-runtime`)
*   **Image:** Custom Python 3.12-slim environment.
*   **Purpose:** Where the agent's code actually runs.
*   **Security:** Isolated from the host laptop, with API keys injected via environment variables.

---

## 🚀 Getting Started

### Prerequisites
1.  **Docker Desktop** installed and running.
2.  A vault-backed env file containing only **vault references**, not real secret values. See [`../../examples/docker/.env.example`](../../examples/docker/.env.example).

### Step 1: Start the Environment
Run the following command in your terminal from the `examples/docker/` directory:

```bash
op run --env-file=.env.example -- docker compose up -d --build
```
*Docker will download the database, build the Python image, and start them both in the background.*

### Step 2: Enter the Sandbox
To run commands inside the isolated container, "bash" into it:

```bash
docker exec -it noemi-agent-runtime bash
```
*Your terminal prompt will change, indicating you are now securely inside the Linux container.*

### Step 3: Wake up the Agent
Inside the container, run the "Hello World" agent:

```bash
python agent.py
```
*If everything is set up correctly, the agent will initialize, reach out to the Gemini API, and print its activation acknowledgment in green text.*

---

## 🛠️ Development Workflow

Because the local directory is mounted as a volume (`.:/app`) in the `docker-compose.yml`, you can:
1.  Edit `agent.py` in your favorite IDE (like VS Code) on your host machine.
2.  Save the changes.
3.  Run `python agent.py` again inside the container terminal.
4.  **Instant results**—no rebuilding of the container is required for code changes.

---

## 📦 File Structure

The following files located in `examples/docker/` make this sandbox possible:

*   **`docker-compose.yml`**: Orchestrates the database and runtime containers.
*   **`Dockerfile`**: Defines the Python environment and installs `uv` for package management.
*   **`requirements.txt`**: Lists dependencies (`google-genai`, `psycopg2-binary`).
*   **`agent.py`**: A baseline agent script to verify connectivity and environment injection.

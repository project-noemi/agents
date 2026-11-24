# Install Node tooling and the MCP server at build time, never through npx at runtime.
FROM node:24.18.1-bookworm-slim@sha256:235600a8101ab264e117b1768e925532262668dc9b581ef1dd7d96ced463b8e7 AS gmail-mcp
RUN npm install --global --prefix /opt/gmail-mcp --ignore-scripts --no-audit --no-fund @klodr/gmail-mcp@3.0.0

# Pin the image digest so rebuilding uses the same Python runtime.
FROM python:3.13-slim-bookworm@sha256:281d39ff02e3b389401586134ff9e6572954687822a58055ec07a60ded4e0b7f

ENV PYTHONPATH=/app/src \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY --from=gmail-mcp /usr/local/bin/node /usr/local/bin/node
COPY --from=gmail-mcp /opt/gmail-mcp /opt/gmail-mcp
ENV PATH="/opt/gmail-mcp/bin:${PATH}"
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/noemi_mailsort/*.py src/noemi_mailsort/
COPY config/labels.example.json config/model.example.json config/gmail.example.json config/processing.example.json config/automatic.example.json config/
COPY examples/emails.example.json examples/emails.example.json
COPY prompts/classification_instructions.txt prompts/label_prediction.txt prompts/confidence_scoring.txt prompts/
COPY tests/test_prompts.py tests/test_predictions.py tests/test_ollama.py tests/test_classify.py tests/test_gmail_mcp.py tests/test_dry_run.py tests/test_import_labels.py tests/test_create_base_labels.py tests/test_label_messages.py tests/test_automatic.py tests/
COPY tests/test_results_csv.py tests/

USER 10001:10001

ENTRYPOINT ["python", "-m", "noemi_mailsort.prompts"]
CMD ["--labels", "config/labels.example.json", "--mode", "labels"]

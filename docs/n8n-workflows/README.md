# n8n Lab Workflows

These JSON files are Layer B classroom canvases (several are Hungarian-language labs). The **canonical model pin** is Google Gemini 2.5 Flash via `@n8n/n8n-nodes-langchain.googleGemini`.

## Grok variant

n8n does **not** ship a standalone Grok root node equivalent to `googleGemini`. The official xAI path is:

1. **Basic LLM Chain** (`@n8n/n8n-nodes-langchain.chainLlm`) on the main branch
2. **xAI Grok Chat Model** (`@n8n/n8n-nodes-langchain.lmChatXAiGrok`) attached on `ai_languageModel`
3. xAI API credential (`REPLACE_WITH_YOUR_XAI_API_CREDENTIAL_ID`)
4. Switch / IF expressions that read `$json.text` (chain output), **not** Gemini's `$json.content.parts[0].text` or `$json.candidates[0].content.parts[0].text`

Ready-to-import Grok companions (English, same lesson as the Gemini originals):

- [`../../n8n-templates/layer-b-labs/customer-inquiry-router-grok.json`](../../n8n-templates/layer-b-labs/customer-inquiry-router-grok.json)
- [`../../examples/workflows/rfp-responder-grok.json`](../../examples/workflows/rfp-responder-grok.json)

Do not retarget these Hungarian lab files away from Gemini. If a cohort needs Grok here, duplicate a lab and apply the four steps above. Gemini 2.5 Flash remains the repository baseline.

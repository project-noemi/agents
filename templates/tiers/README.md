# Client Tier Templates

Reference templates for the `Client Onboarding` agent (`agents/operations/client-onboarding.md`).

Each tier captures the default set of MCPs, skills, and operating profiles applied when provisioning a new client tenant. These are starter templates intended to be copied into `clients/<client-slug>/` and then refined for the specific tenant.

## Available Tiers

- [`basic.yaml`](basic.yaml) — minimal observability and one engineering agent
- [`standard.yaml`](standard.yaml) — adds guardian and reporting skills
- [`premium.yaml`](premium.yaml) — full fleet (engineering, operations, guardian, ROI)

## Usage

The `Client Onboarding` agent reads a tier template, substitutes the client slug, and emits the provisioned configuration into `clients/<client-slug>/`. See the persona spec for the full workflow.

> Note: These are reference manifests, not runtime configuration. The actual orchestrator (Gemini CLI, n8n, or LangChain) consumes the materialized client configuration.

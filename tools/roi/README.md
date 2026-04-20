# Automated Validation & ROI Modeling

## Overview
This directory documents the methodology for calculating the Return on Investment (ROI) for Project NoéMI agents. Following the "Feynman Requirement" for automated validation, we focus on measurable business value through labor-cost-avoidance that can be traced back to real execution evidence.

## ROI Calculation Methodology
The ROI model is calculated using a Google Sheets template. The methodology is based on:
1. **Task Identification**: Break down agent responsibilities into discrete, repeatable tasks.
2. **Human Baseline Definition**: Record a conservative estimate for how long the same task takes a human.
3. **Execution Validation**: Count only tasks that can be tied to structured logs or orchestrator events.
4. **Labor Cost Avoidance**: Calculate the financial value of time saved using standardized loaded hourly rates.
5. **Net ROI**: Subtract platform, implementation, and maintenance costs from gross cost avoidance.

## NoeMI ROI Principles

The official calculator should follow these rules:

- **Evidence first**: Only count executions with a real `execution_id`, timestamp, and source system.
- **Conservative valuation**: When baseline human time is ambiguous, choose the lower credible savings estimate.
- **Explainability**: Every dollar in the sheet should be explainable to a CFO, CISO, or operator.
- **Separation of concerns**: Keep gross labor-cost avoidance separate from net ROI after investment and operating costs.
- **No PII or secrets**: The sheet may reference execution records, but it must not contain credentials or personally identifiable information.

## Google Sheets Template
The official ROI calculator is published as a public Google Sheet so anyone can open it anonymously and make a copy for their own deployment.

- **Public Sheet Link**: [Project NoeMI ROI Calculator Template](https://docs.google.com/spreadsheets/d/1BFMzZFs9oXAdgccjq5y1A6xba-m4nVXC)
- **Local Workbook Artifact**: [`project-noemi-roi-calculator-template.xlsx`](./project-noemi-roi-calculator-template.xlsx)
- **Generator Script**: [`generate_roi_template.py`](./generate_roi_template.py)
- **Key Features**:
  - Per-agent line items.
  - Automated ROI summation across the fleet.
  - Separation of gross cost avoidance from net ROI.
  - Visual dashboards for "High-Tech Surfboard" performance.
  - Conservative, auditable calculations suitable for operator and executive review.

## Recommended Tab Structure

The template should include the following tabs.

### 00_README

Purpose:

- Explain what the calculator measures
- Explain what should and should not be counted
- Provide the operating instructions for teams using the sheet

Suggested fields:

- `deployment_name`
- `client_name`
- `owner`
- `currency`
- `review_cadence`
- `baseline_last_approved_on`
- `notes`

### 01_ASSUMPTIONS

Purpose:

- Store the approved loaded hourly rates used for valuation
- Make rate ownership and review dates explicit

Suggested columns:

- `role_id`
- `human_role`
- `loaded_hourly_rate`
- `rate_source`
- `approved_by`
- `approved_on`
- `notes`

### 02_TASK_CATALOG

Purpose:

- Define the approved tasks that are allowed to generate ROI
- Store the human baseline and review overhead for each task

Suggested columns:

- `task_id`
- `agent_persona`
- `task_name`
- `business_function`
- `human_role_owner`
- `human_baseline_minutes`
- `human_review_minutes`
- `exception_minutes`
- `evidence_required`
- `approved_for_roi`
- `baseline_owner`
- `baseline_last_reviewed`

### 03_EXECUTION_LOG

Purpose:

- Serve as the append-only automation target for validated executions
- Capture enough evidence to trace every entry back to a real task

Suggested columns:

- `execution_id`
- `timestamp_utc`
- `tenant_id`
- `agent_persona`
- `task_id`
- `status`
- `trace_id`
- `quantity`
- `review_required`
- `evidence_ref`
- `source_system`
- `notes`

### 04_ROI_AUDIT

Purpose:

- Join the execution log to assumptions and task baselines
- Compute auditable per-execution value

Suggested columns:

- `execution_id`
- `month`
- `task_id`
- `human_role_owner`
- `baseline_minutes`
- `review_minutes`
- `exception_minutes`
- `net_minutes_saved`
- `hours_saved`
- `hourly_rate`
- `gross_cost_avoidance`
- `included_in_roi`
- `exclusion_reason`
- `confidence_band`
- `can_this_be_explained_to_a_cfo`

### 05_INVESTMENT

Purpose:

- Capture the real costs required to produce net ROI
- Prevent labor-cost avoidance from being confused with profit

Suggested columns:

- `cost_id`
- `category`
- `cost_type`
- `description`
- `billing_frequency`
- `monthly_cost`
- `one_time_cost`
- `owner`
- `notes`

Recommended categories:

- `implementation`
- `platform`
- `maintenance`
- `managed_service`
- `training`

### 06_DASHBOARD

Purpose:

- Provide an executive view of value, cost, and confidence
- Highlight which agents and tasks are driving validated outcomes

Suggested metrics:

- `validated_executions`
- `hours_saved_mtd`
- `gross_cost_avoidance_mtd`
- `operating_cost_mtd`
- `net_benefit_mtd`
- `annualized_net_benefit`
- `roi_percent`
- `payback_months`
- `top_agents_by_value`
- `top_tasks_by_value`
- `excluded_executions`

## Recommended Formulas

Use simple, auditable formulas:

- `net_minutes_saved = MAX(0, human_baseline_minutes - human_review_minutes - exception_minutes)`
- `hours_saved = net_minutes_saved / 60`
- `gross_cost_avoidance = hours_saved * loaded_hourly_rate`
- `monthly_gross_benefit = SUMIFS(gross_cost_avoidance, month, selected_month, included_in_roi, TRUE)`
- `monthly_net_benefit = monthly_gross_benefit - monthly_operating_cost`
- `roi_percent = IF(total_investment=0, "", (annual_gross_benefit - total_investment) / total_investment)`
- `payback_months = IF(monthly_net_benefit<=0, "", one_time_cost / monthly_net_benefit)`

## Suggested Starter Tasks

The initial public template should include example rows for common NoeMI use cases:

- `gatekeeper_pr_triage`
- `knowledge_manager_internal_answer`
- `linux_daily_health_check`
- `seo_metadata_generation`
- `video_content_packaging`

## Automation Contract for the ROI Auditor

The [`agents/guardian/roi-auditor.md`](../../agents/guardian/roi-auditor.md) persona should append only to the execution-oriented tab and should never rewrite assumptions or baselines without human approval.

Recommended behavior:

- append validated execution entries into `03_EXECUTION_LOG`
- read approved baselines from `02_TASK_CATALOG`
- read labor assumptions from `01_ASSUMPTIONS`
- leave approval-sensitive tabs protected for human owners

## Usage
1. Regenerate the workbook if needed with `python3 tools/roi/generate_roi_template.py`.
2. Upload [`project-noemi-roi-calculator-template.xlsx`](./project-noemi-roi-calculator-template.xlsx) to Google Sheets.
3. Protect the assumptions, task catalog, and investment tabs from casual editing.
4. Publish the uploaded sheet as the public Project NoeMI ROI sheet and confirm anonymous read access works from the direct sheet URL.
5. Make a copy for each client, deployment, or internal program.
6. Populate the approved human baselines and loaded labor rates.
7. Append validated execution data through automation or controlled import.
8. Review the dashboard monthly with operators and executive stakeholders.

## Publishing Checklist

Before the public template link is added here, confirm that the sheet:

- contains no internal-only pricing or client data
- contains no secrets, credentials, or API references
- uses example rows only
- protects approval-sensitive tabs
- exposes a clean "Make a copy" workflow for public use

# Agent ROI Calculator — Google Sheets Template

## Overview

This ROI calculator measures the return on investment from deploying Project NoeMI agents by quantifying **time savings per task** that has been transferred from human workers to agents. The model follows a standard labor-cost-avoidance methodology, which is the most widely accepted approach for measuring automation ROI in enterprise environments.

**Google Sheets Template:** [TODO: Insert published link to template]

---

## Methodology

### Core Formula

```
Net ROI (%) = ((Total Annual Savings - Total Annual Cost) / Total Annual Cost) x 100
```

Where:
- **Total Annual Savings** = Sum of (Hours Saved per Task x Task Frequency x Fully Loaded Hourly Rate) across all agents
- **Total Annual Cost** = Agent platform costs + API/token costs + maintenance labor + onboarding/training investment

### Per-Agent ROI Calculation

Each agent gets a line item. For every agent, identify each **task** that has been transferred and calculate:

```
Agent Annual Savings = SUM across tasks of:
    (Human Time per Task - Agent Time per Task) x Executions per Year x Hourly Rate
```

### Fully Loaded Hourly Rate

Use the **fully loaded cost**, not just salary. A common industry multiplier is 1.3x-1.5x base salary to account for benefits, overhead, and management time.

```
Fully Loaded Hourly Rate = (Annual Salary x Burden Multiplier) / Annual Working Hours
```

Example: $80,000 salary x 1.4 burden / 1,880 hours = ~$59.57/hour

---

## Sheet Structure

### Tab 1: Agent Roster

| Column | Description |
|--------|-------------|
| Agent Name | e.g., `bolt`, `sentinel`, `brand-strategist` |
| Domain | e.g., `coding`, `marketing`, `operations` |
| Status | `Active`, `Pilot`, `Planned` |
| Owner | Team or person responsible |

### Tab 2: Task Inventory (one row per task per agent)

| Column | Description | Example |
|--------|-------------|---------|
| Agent Name | Which agent performs this task | `sentinel` |
| Task Name | Descriptive name of the transferred task | `PR security review` |
| Human Time (hrs) | Average time a human takes per execution | `1.5` |
| Agent Time (hrs) | Average time the agent takes (including human review) | `0.25` |
| Time Saved (hrs) | `= Human Time - Agent Time` (calculated) | `1.25` |
| Frequency (per year) | How often this task occurs annually | `520` |
| Applicable Role | The human role this replaces | `Senior Engineer` |
| Hourly Rate ($) | Fully loaded hourly rate for that role | `$75.00` |
| Annual Savings ($) | `= Time Saved x Frequency x Hourly Rate` (calculated) | `$48,750` |
| Confidence | `High`, `Medium`, `Low` — how reliable the estimates are | `Medium` |
| Notes | Assumptions, measurement method, or caveats | `Based on Q1 sample` |

### Tab 3: Cost Inventory

| Column | Description | Example |
|--------|-------------|---------|
| Cost Category | Type of expense | `API / Token Costs` |
| Monthly Cost ($) | Recurring monthly expense | `$500` |
| Annual Cost ($) | `= Monthly x 12` or one-time amount | `$6,000` |
| Notes | Vendor, tier, assumptions | `Claude API, ~2M tokens/month` |

Typical cost categories:
- API / token costs (LLM provider)
- Platform or orchestrator hosting
- MCP server infrastructure
- Agent maintenance and updates (engineering time)
- Initial setup and onboarding (amortized over 12 months)

### Tab 4: ROI Summary (auto-calculated)

| Metric | Formula |
|--------|---------|
| Total Annual Savings | `= SUM(Task Inventory: Annual Savings)` |
| Total Annual Cost | `= SUM(Cost Inventory: Annual Cost)` |
| Net Annual Benefit | `= Total Annual Savings - Total Annual Cost` |
| ROI (%) | `= (Net Annual Benefit / Total Annual Cost) x 100` |
| Payback Period (months) | `= Total Annual Cost / (Total Annual Savings / 12)` |
| High-Confidence Savings | `= SUMIFS` filtered to Confidence = `High` |
| Savings by Domain | Pivot by domain from Agent Roster |
| Savings by Agent | Pivot by agent name |

---

## Best Practices

1. **Measure before and after.** Establish a baseline for human task duration before deploying an agent. Use time-tracking data, not guesses, wherever possible.

2. **Include human review time in agent cost.** Agent Time should include any time a human spends reviewing, approving, or correcting the agent's output. An agent that produces a PR review in 2 minutes but requires 15 minutes of human verification saves less than it appears.

3. **Use conservative estimates.** When in doubt, round human time down and agent time up. Overstating ROI erodes trust in the model. The Confidence column exists to flag uncertain numbers.

4. **Track quality, not just speed.** If an agent produces lower-quality output that requires rework, factor rework time into Agent Time. Conversely, if agent output quality exceeds human baseline (e.g., fewer missed security issues), note this qualitatively.

5. **Revisit quarterly.** Task frequencies change, agent capabilities improve, and costs shift. Schedule quarterly reviews to update estimates with actuals.

6. **Start with high-frequency tasks.** The biggest ROI comes from tasks that happen often, not tasks that take the longest. A 10-minute task done 1,000 times/year saves more than a 4-hour task done 10 times/year.

7. **Account for indirect benefits separately.** Reduced context-switching, faster cycle times, and improved employee satisfaction are real but hard to quantify. List them qualitatively in the Summary tab rather than inflating the savings numbers.

---

## Getting Started

1. Copy the Google Sheets template (link above)
2. Fill in the **Agent Roster** with your deployed or planned agents
3. For each agent, list every task transferred in the **Task Inventory**
4. Estimate or measure human time and agent time per task
5. Fill in your **Cost Inventory** with actual or projected costs
6. Review the auto-calculated **ROI Summary**

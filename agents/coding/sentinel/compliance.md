# Compliance guidance

This file is the source for the review's compliance gate. It sits next to the Sentinel persona and is loaded from this blueprint, not from the repository under review.

It is guidance. It is not a legal opinion and not a certification. The deploying organization chooses whether to follow it. A human may merge a pull request that fails only this gate, and that merge does not require a calibration entry. A failure of premise, framing, or code still does.

The shared baseline is the European Union Artificial Intelligence Act (Regulation (EU) 2024/1689) and the General Data Protection Regulation (Regulation (EU) 2016/679). An organization outside the Union can still use this baseline. A duty that applies only to one organization belongs in that organization's own agents repository. This file does not fail a change merely because the organization is outside the European Union.

## European AI Act

Use these as questions, not as a checklist that every pull request must satisfy.

- **Prohibited uses.** Do not add a system that socially scores people, that scrapes facial images from the internet or CCTV to build a recognition database, that manipulates people by exploiting age or disability, or that recognizes emotions in a workplace or a school. Real-time remote biometric identification in a public space is restricted to narrow law-enforcement cases. If a change builds one of these, report it on the compliance gate.
- **Human oversight.** A system that makes a decision about a person (access, credit, employment, essential services, law enforcement) needs a named human who can stop it. The coding loop already keeps merge and approval with a human. A change that removes that human step conflicts with this guidance.
- **Transparency.** When a person is interacting with an AI system and the Act requires them to know that, the product should say so. A review mentions the gap. It does not draft a legal notice.
- **Records.** A higher-risk system should be able to show what it did. An audit log that contains secrets or personal data is not the record this guidance means.

## GDPR

- **Minimize.** Collect and keep only the personal data the stated purpose needs. Do not put personal data into source, fixtures, prompts, model logs, or the pull request body.
- **Purpose.** A change that starts collecting or exporting personal data should say why, where it goes, and how long it is kept.
- **Special categories.** Health, biometrics, religion, union membership, sex life, and similar data need an explicit reason. Silence is not a reason.
- **Onward transfer.** Sending personal data to a model provider, a log sink, or another organization is a disclosure. The description should name it.

## What the reviewer may say

On the compliance gate, report a finding when the diff clearly conflicts with a duty named above. Examples: personal data written into a prompt or a log, a prohibited use added as a feature, or a human approval step removed.

Do not invent a legal conclusion, demand a data-protection impact assessment, or declare an organization non-compliant. A missing mention of Europe is not a finding.

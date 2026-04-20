# Network Security Assessment Procedure

This document provides the concrete technical validation procedure for the Phase 0 Security Assessment. It maps specific scan categories to the assessment areas defined in [security-assessment.md](security-assessment.md) and provides a step-by-step deployment guide.

The example workflow below uses **Kaseya RapidFire Tools / Network Detective Pro** as the reference tooling. However, the scan categories, coverage expectations, and deployment process apply to **any equivalent assessment platform**. The goal is not to mandate a particular vendor. The goal is to ensure the assessment is performed thoroughly enough to give a reliable picture of the organization's security posture before an AI initiative begins.

For the assessment areas and executive questions this procedure supports, see [security-assessment.md](security-assessment.md). For authorization before any scanning begins, see [consent-template.md](consent-template.md).

## Scan-to-Assessment-Area Mapping

The following table maps seven scan categories to the seven assessment areas defined in [security-assessment.md](security-assessment.md) and the control-area rows in [report-template.md](report-template.md) Section 6.

| Scan Category | Example Tool (Network Detective Pro) | Assessment Areas Covered | Report Section 6 Rows Fed |
|---------------|---------------------------------------|--------------------------|---------------------------|
| LAN and Network Discovery | Network Detective LAN Scanner | Identity/MFA (#1), Endpoint/Server Hygiene (#3) | Identity and MFA; Privileged access and service accounts; Endpoint / server hygiene |
| Endpoint Assessment | Computer Scanner | Endpoint/Server Hygiene (#3) | Endpoint / server hygiene |
| Cyber Risk and Compliance Scan | Cybersecurity Computer Scanner | Endpoint/Server Hygiene (#3), Data Boundaries (#2) | Endpoint / server hygiene; Data classification and refusal boundaries |
| Cloud Identity and Configuration | Azure / Entra ID Scanner | Identity/MFA (#1), Third-Party Exposure (#7) | Identity and MFA; Privileged access and service accounts; Third-party / vendor risk |
| External Vulnerability Scan | Network Detective External Scanner | Third-Party Exposure (#7) | Third-party / vendor risk; Incident response and governance |
| Database Security Assessment | SQL Server Scanner | Data Boundaries (#2), Secrets/APIs (#6) | Data classification and refusal boundaries; Secrets management |
| Dark Web Credential Monitoring | RapidFire Dark Web Monitoring | Identity/MFA (#1), Third-Party Exposure (#7) | Identity and MFA; Third-party / vendor risk |

## Assessment Areas Not Covered by Automated Scanning

Automated scans provide valuable technical evidence, but they do not cover everything. The following assessment areas require interviews, document review, and operational evidence gathering as described in [../PHASE_ZERO_SECURITY_BASELINE.md](../PHASE_ZERO_SECURITY_BASELINE.md):

- **Backup and Recovery** — No scan verifies that restore procedures work, that backups are isolated or immutable, or that recovery ownership is defined.
- **Logging, Monitoring, and Forensics** — Scans do not evaluate whether logs are centralized, whether alerts are triaged, or whether retention meets investigation needs.
- **Secrets Management Practices** — Scans may detect some credential patterns, but they do not assess whether the organization uses a vault, rotates secrets, or has eliminated plaintext credential habits.
- **Incident Response Planning** — No scan evaluates whether an incident response plan exists, has been tested, or names the right owners.
- **Data Classification Policy** — Scans surface configuration facts. They do not assess whether the organization has written data categories, refusal boundaries, or human-only data classes.
- **Human Approval Boundaries** — These are organizational decisions, not technical configurations. They must be established through stakeholder conversations.

A complete Phase 0 assessment combines scan evidence with these interview and review findings. Scans alone are not sufficient.

## Per-Scan Procedure Details

### 1. LAN and Network Discovery

**What it does:** Discovers the network topology, device inventory, Active Directory structure, group policy settings, open shares, DNS and DHCP configuration, and security policy status across the local network.

**Prerequisites:**
- Admin-level access to a domain-joined workstation on the client LAN
- Network connectivity to the systems being scanned
- Firewall rules that allow discovery traffic within the LAN

**Deployment:** The client downloads a scanner package and runs it from a workstation on the LAN. The scanner collects data locally and produces a data file for analysis.

**Expected runtime:** 30 to 60 minutes depending on network size.

**Expected outputs:**
- Device and server inventory
- Active Directory users, groups, and organizational units
- Group policy configuration
- Open network shares and permissions
- DNS and DHCP configuration
- Password policy settings
- Security configuration baselines

**Key findings to look for:**
- Stale or disabled AD accounts that remain active
- Over-permissive network shares
- Missing or weak group policy settings
- Undocumented devices on the network
- Weak password policies
- Unpatched operating systems visible on the network

**Limitations:** Does not scan cloud-only environments. Requires network connectivity to all target systems. Does not assess wireless network security unless the scanning workstation is on the wireless segment.

### 2. Endpoint Assessment

**What it does:** Scans individual workstations and laptops for patch status, installed software, local admin accounts, disk encryption status, antivirus configuration, and security settings.

**Prerequisites:**
- Local admin access on each target endpoint
- Representative sample of endpoints across the organization (not every device needs to be scanned, but the sample should reflect the diversity of the fleet)

**Deployment:** The client runs the endpoint scanner on each representative device. Each scan produces a data file.

**Expected runtime:** 15 to 30 minutes per device.

**Expected outputs:**
- Operating system version and patch level
- Installed software inventory
- Local administrator accounts
- Disk encryption status (BitLocker, FileVault)
- Antivirus or EDR agent status and definition currency
- Security configuration settings

**Key findings to look for:**
- Missing critical security patches
- Unmanaged local admin accounts
- Disabled or absent disk encryption
- Outdated antivirus definitions or missing EDR agents
- Unauthorized or high-risk software installed

**Limitations:** Must be run on each individual device. Does not cover mobile devices or unmanaged BYOD endpoints. Results represent the state at the time of the scan.

### 3. Cyber Risk and Compliance Scan

**What it does:** Performs an extended security scan that evaluates endpoint configurations against compliance frameworks (NIST CSF, CIS Benchmarks) and optionally includes a malware detection scan.

**Prerequisites:**
- Local admin access on target endpoints
- Decision on whether to include the malware scan component (the malware scan adds runtime but can reveal active threats)

**Deployment:** The client runs the cybersecurity scanner on target endpoints. Two variants are typically offered: a full scan including malware detection, and a lighter scan without it.

**Expected runtime:** 30 to 90 minutes per device depending on whether the malware scan is included.

**Expected outputs:**
- Security configuration assessment against selected compliance frameworks
- Vulnerability assessment results
- Compliance gap analysis
- Malware detection results (if included)

**Key findings to look for:**
- Configuration drift from security baselines
- Compliance gaps that would affect regulated data handling
- Known vulnerabilities on scanned endpoints
- Active malware or indicators of compromise (if malware scan is included)

**Limitations:** Point-in-time snapshot only. Compliance mapping is indicative and does not constitute a formal certification. The malware scan covers known signatures and may not detect advanced persistent threats.

### 4. Cloud Identity and Configuration (Azure / Entra ID)

**What it does:** Evaluates Microsoft 365 and Azure AD (Entra ID) configuration including MFA enrollment, Conditional Access policies, admin role assignments, license allocations, and security defaults.

**Prerequisites:**
- The client must create an app registration in Azure and provide:
  - **Client ID**
  - **Tenant ID**
  - **Client Secret Token**
- The app registration must have read permissions for Azure AD / Entra ID
- Documentation for creating the app registration: see the vendor's Azure scan prerequisites guide

**Deployment:** The assessor configures the provided credentials in the scanning platform. The scan runs against the Microsoft cloud environment without requiring anything to be installed on client endpoints.

**Expected runtime:** 15 to 30 minutes.

**Expected outputs:**
- MFA enrollment status per user
- Conditional Access policy inventory and gaps
- Admin role assignments and over-privileged accounts
- License allocation summary
- Security defaults status
- Risky sign-in and identity protection configuration
- Guest and external user inventory

**Key findings to look for:**
- Users without MFA enrolled
- Over-privileged admin roles (Global Admin assigned too broadly)
- Missing or incomplete Conditional Access policies
- Stale guest or external accounts
- Security defaults disabled without equivalent Conditional Access coverage

**Limitations:** Requires correct Azure AD permissions granted through the app registration. Does not assess Azure infrastructure resources (VMs, storage, networking) beyond identity and access configuration. Does not cover non-Microsoft cloud environments.

### 5. External Vulnerability Scan

**What it does:** Scans public-facing IP addresses for open ports, service versions, SSL/TLS configuration, known CVEs, and misconfigurations on internet-exposed services.

**Prerequisites:**
- The client must provide the public IP addresses or ranges to be scanned
- Written authorization is required (reference [consent-template.md](consent-template.md))
- The client should confirm that no third-party hosting provider requires separate notification before scanning

**Deployment:** The scan is initiated remotely against the client-provided IP addresses. Nothing needs to be installed on the client's systems.

**Expected runtime:** 30 to 60 minutes depending on the number of IPs and services exposed.

**Expected outputs:**
- Open port inventory per IP address
- Service identification and version detection
- SSL/TLS certificate status and configuration
- Known CVE matches for detected service versions
- Misconfiguration findings

**Key findings to look for:**
- Exposed management interfaces (RDP, SSH, admin panels)
- Weak or expired SSL/TLS configurations
- Unpatched public-facing services with known vulnerabilities
- Unnecessary open ports
- Services that should not be internet-facing

**Limitations:** Only scans the IP addresses provided. Does not discover assets the client has not identified. This is not a penetration test — it identifies exposure but does not attempt exploitation. Web application vulnerabilities (SQL injection, XSS) require a separate application-layer assessment.

### 6. Database Security Assessment (SQL Server)

**What it does:** Assesses SQL Server instances for security configuration, authentication settings, patch level, access controls, encryption status, and audit configuration.

**Prerequisites:**
- Read access to the SQL Server instances to be assessed
- Network connectivity from the scanning machine to the SQL Server
- Instance names and connection details

**Deployment:** The client runs the SQL Server assessment tool from a machine with network access to the target database instances.

**Expected runtime:** 15 to 30 minutes per instance.

**Expected outputs:**
- SQL Server version and patch level
- Authentication mode (Windows vs. mixed mode)
- SA account status
- User and role inventory
- Database encryption status (TDE)
- Audit and logging configuration

**Key findings to look for:**
- Mixed-mode authentication enabled (allows SQL logins alongside Windows auth)
- SA account enabled or using a weak password
- Unpatched SQL Server instances
- Missing Transparent Data Encryption on databases with sensitive data
- Weak access controls or overly permissive roles
- Audit logging not enabled

**Limitations:** Requires network access and appropriate database permissions. Does not assess application-layer SQL injection risks. Does not cover non-SQL-Server database platforms (PostgreSQL, MySQL, Oracle) without equivalent tooling.

### 7. Dark Web Credential Monitoring

**What it does:** Checks whether organizational email addresses and credentials have appeared in known data breach databases available on the dark web.

**Prerequisites:**
- The client provides the email domain(s) to monitor
- No client-side installation is required

**Deployment:** The assessor configures the monitoring on the assessment platform. The client does not need to run anything.

**Expected runtime:** Initial results are typically available within 48 hours. Ongoing monitoring continues after the initial scan.

**Expected outputs:**
- List of exposed email/credential pairs
- Breach source information (which breaches the credentials appeared in)
- Exposure timeline (when the credentials were first detected)

**Key findings to look for:**
- Number of exposed credentials
- Whether exposed credentials belong to current employees
- Whether exposed credentials match active accounts (compare against the Azure / Entra ID scan results)
- Accounts with exposed credentials that also lack MFA (critical risk)

**Limitations:** Only detects credentials that have appeared in known, indexed breach databases. Does not detect credentials exposed through private channels, targeted attacks, or breaches that have not yet been cataloged. Does not determine whether exposed credentials have been changed since the breach.

## Client Deployment Guide

The following is a ready-to-send communication template for deploying the assessment scans. Replace the placeholders (`[LINK: ...]`, `[CLIENT_NAME]`, `[YOUR_NAME]`) before sending.

---

**Subject:** Phase 0 Security Assessment — Scan Deployment Steps

Hi [CLIENT_NAME],

As part of the Phase 0 security assessment, we need to run a series of non-invasive scans to establish a baseline of your current security posture. These scans are read-only and do not make any changes to your systems.

Below are the steps for each scan, along with what you will need to provide or run on your end.

### 1. LAN and Network Discovery

Run this scan from a domain-joined workstation on your network. It collects information about your network devices, Active Directory, group policies, and security configuration.

- Download and instructions: [LINK: LAN Scanner package]
- Reference documentation: [LINK: LAN scan help page]

**Your time commitment:** Download, run, and upload results — approximately 45 minutes.

### 2. Endpoint Assessment (Laptops and Workstations)

Run this scanner on a representative sample of your laptops and workstations. It checks patch status, encryption, antivirus, and security settings.

- Download: [LINK: Computer Scanner]
- Reference documentation: [LINK: Endpoint scan help page]

**Your time commitment:** 15 to 30 minutes per device.

### 3. Cyber Risk and Compliance Scan

Run this extended security scanner on the same or additional endpoints. Two options are available:

- Full scan (includes malware check): [LINK: Cybersecurity Scanner — full]
- Without malware check: [LINK: Cybersecurity Scanner — no malware]

**Your time commitment:** 30 to 90 minutes per device depending on the option chosen.

### 4. Azure / Entra ID (Cloud Identity)

This scan evaluates your Microsoft 365 and Azure AD configuration. You will need to create an app registration in Azure and provide the following:

- **Client ID**
- **Tenant ID**
- **Client Secret Token**

Step-by-step instructions for creating the app registration: [LINK: Azure scan prerequisites]

**Your time commitment:** 15 to 20 minutes to create the app registration and share the credentials.

### 5. External Vulnerability Scan

We will scan your public-facing IP addresses for exposure and known vulnerabilities. Please provide:

- The public IP addresses or ranges you would like us to scan

**Your time commitment:** Just send us the IP list. The scan runs on our end.

### 6. SQL Server Assessment

If you have SQL Server instances in your environment, please run this assessment tool from a machine with network access to the database.

- Download: [LINK: SQL Server Scanner]
- Reference documentation: [LINK: SQL scan help page]

**Your time commitment:** 15 to 30 minutes per SQL Server instance.

### 7. Dark Web Credential Monitoring

We have already initiated dark web monitoring for your domain. Initial results are typically available within 48 hours. No action is needed on your end for this scan.

---

### What We Need From You

Please send us the following when you are ready:

- [ ] Public IP addresses for the external vulnerability scan
- [ ] Azure / Entra credentials (Client ID, Tenant ID, Client Secret)
- [ ] Confirmation of which endpoints you will scan (we recommend a representative sample across roles)
- [ ] SQL Server instance details (if applicable)
- [ ] A contact who can run the LAN scan from a domain-joined workstation

Note: Some download links require a Google account for access. Let us know if you need to be added.

### What Happens After the Scans

Once all scan data is collected, we will consolidate the results and combine them with our interview and document review findings to produce a complete Phase 0 security assessment report. The report will include:

- findings grouped by severity
- business impact for each finding
- a clear distinction between items that block the AI initiative and items that can be addressed in parallel
- a readiness classification and recommended next steps

Please reach out with any questions about the deployment process.

Thank you,
[YOUR_NAME]

---

## Using Scan Results in the Phase 0 Report

Scan outputs are evidence inputs, not the final assessment. To produce the report:

1. **Map each scan finding** to the correct row in [report-template.md](report-template.md) Section 6 (Security Readiness By Control Area).
2. **Classify by severity** — Critical, High, Moderate, or Low — based on business impact and exploitability, not just the scanner's default rating.
3. **Supplement with context** — Scan findings should be enriched with interview and document review observations. A finding like "40% of users lack MFA" has different weight depending on whether those users handle regulated data or have admin access.
4. **Note coverage gaps** — If any scan was not performed (for example, no SQL Server in the environment), document why and confirm the corresponding assessment area was addressed through other means.
5. **Feed the readiness classification** — Scan evidence contributes to but does not determine the final readiness classification in [readiness-rubric.md](readiness-rubric.md). The classification considers the full picture including organizational maturity, not just technical findings.

## Adapting This Workflow to Other Tooling

This document uses Kaseya RapidFire Tools / Network Detective Pro as the reference example because it covers all seven scan categories in a single platform. However, the assessment areas and coverage expectations remain the same regardless of which tools are used.

What matters is that every scan category listed in the mapping table is addressed with sufficient depth. The following table maps scan categories to their generic equivalents:

| Scan Category | What Any Equivalent Tool Must Cover |
|---------------|-------------------------------------|
| LAN and Network Discovery | Device inventory, AD enumeration, group policy review, network share permissions |
| Endpoint Assessment | Patch status, encryption, AV/EDR status, local admin accounts, security configuration |
| Cyber Risk and Compliance | Configuration assessment against a recognized framework (NIST, CIS), vulnerability identification |
| Cloud Identity and Configuration | MFA enrollment, admin role review, Conditional Access or equivalent policy review, guest accounts |
| External Vulnerability Scan | Port scanning, service identification, CVE matching, SSL/TLS assessment |
| Database Security | Authentication mode, patch level, access controls, encryption, audit configuration |
| Dark Web Credential Monitoring | Breach database lookup for organizational email domains |

Examples of alternative tools that cover one or more categories:

- **Vulnerability scanning:** Nessus, Qualys, OpenVAS
- **Endpoint assessment:** CrowdStrike Falcon, Microsoft Defender for Endpoint, Tanium
- **Cloud identity review:** Microsoft Secure Score, Maester, ScubaGear
- **External scanning:** Shodan, Censys, Tenable.io
- **Dark web monitoring:** SpyCloud, Have I Been Pwned (domain search), ID Agent

The critical requirement is coverage, not brand. If the organization or its MSP/MSSP already has tools that cover these categories, those tools should be used.

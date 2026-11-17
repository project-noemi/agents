# Jurisdiction Frameworks — Abuse Takedown Optional Reference

This reference provides detailed legal frameworks for abuse takedown handling. Load specific frameworks when processing notices under that jurisdiction.

## US DMCA (Digital Millennium Copyright Act)

**Framework ID:** `us-dmca`  
**Legal Reference:** 17 USC 512(c) safe harbor  
**Action Deadline:** "Expeditious" (industry practice: 24-48 hours)  
**Notice Elements (512(c)(3)):**
- Work identified
- Infringing URL identified
- Complainant contact details
- Good-faith statement
- Accuracy + penalty-of-perjury authority statement
- Physical or electronic signature

**Counter-Notice (512(g)):**
- Customer has 10-14 business days to submit
- Required: name, address, phone, email; identification of disabled material; reasons and good-faith belief of mistake/misidentification (under penalty of perjury); consent to jurisdiction; signature
- Content restored after 10-14 business days unless complainant files lawsuit and provides proof

**Additional Requirements:**
- Registered DMCA agent with US Copyright Office
- Repeat-infringer termination policy (512(i))

**Transparency:** No mandatory transparency reporting (industry best practice: publish stats)

---

## EU DSA (Digital Services Act)

**Framework ID:** `eu-dsa`  
**Legal Reference:** Regulation (EU) 2022/2065  
**Action Deadline:** "Expeditious" once aware (Art. 6)  
**Notice Mechanism (Art. 16):** Sufficient detail for identification, statement of good-faith belief, affected URL(s), complainant contact, date  
**Statement of Reasons (Art. 17):** Provider must send customer a statement of reasons for content restriction, including facts and grounds, redress options  
**Contact Points (Art. 11-12):** Designated single point of contact, electronic means of communication  
**Transparency Reporting (Art. 15):** Annual transparency reports required (content moderation stats, notices received, actions taken)  

**Customer Redress:**
- Internal complaint-handling system
- Out-of-court dispute resolution (certified bodies)
- Right to challenge decision

---

## Hungary Ekertv. (Electronic Commerce Act)

**Framework ID:** `hu-ekertv`  
**Legal Reference:** 2001. évi CVIII. törvény (Ekertv.) 13 §  
**Action Deadline:** 12 clock hours from compliant notice (no weekend/night exception)  
**Notice Elements:** Rights holder identification, specific content/URL, legal basis statement  
**Customer Notification:** Within 3 business days  
**Customer Objection:** 8 business days from notification to submit written, reasoned objection with proof of lawfulness (e.g., license)  
**Restoration:** If substantiated objection, forward to complainant and await response  

**Compliance Notes:**
- Strict 12-hour deadline (24/7 including weekends)
- Customer may object within 8 business days
- Applies to hosting providers in Hungary or serving Hungarian users

---

## Generic Best Practices (No Jurisdiction Specified)

**Action Deadline:** 24-48 hours (balance speed with due diligence)  
**Notice Validation:** Work, URL, complainant contact, legal basis, signature  
**Customer Notification:** Inform within 2-3 business days  
**Counter-Notice:** Allow 7-14 days for customer response; escalate to Legal before restoration  
**Record Keeping:** Maintain complete documentation for audit and safe harbor  

---

## Adding Additional Jurisdictions

To add a new jurisdiction (e.g., Germany NetzDG, Canada Copyright Act):

1. **Framework ID:** `{country-code}-{law}` (e.g., `de-netzdg`, `ca-copyright`)
2. **Legal Reference:** Statute name and citation
3. **Action Deadline:** Time limit from notice receipt to action (hours or "expeditious")
4. **Notice Elements:** Required fields per jurisdiction
5. **Customer Objection/Counter-Notice:** Timeframe, required content, restoration conditions
6. **Transparency Obligations:** Whether provider must publish reports, notify authorities, etc.
7. **Additional Requirements:** Designated contacts, repeat-infringer policies, etc.

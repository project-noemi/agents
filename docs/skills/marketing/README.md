# Marketing Skills

Skills for producing public marketing material that is published under the organisation's name.

## Skills

| Skill | Spec | Used By |
|-------|------|---------|
| [Brand Image Generation](../../../skills/marketing/brand-image-generation.md) | Generate an image for a post or a request: only quoted text is drawn, the logo is always the real one, placed by a method tested with the model in use, a person accepts each image, and the published bytes match the accepted ones | Social Copywriter (writes the brief) and the coordinator that prepares a campaign |

## Pattern

Marketing skills keep the model to what it does well and put everything that must be exact into code or into a human's hands:
1. The writer works from supplied facts only (see the [Social Copywriter](../../../agents/marketing/social-copywriter.md))
2. Exact elements, such as text on an image or a logo, are quoted or come from the real file
3. A person accepts each piece before it is published ([Human-Approval Gates](../../../guardian-layer/approval-gates.md))
4. Publishing is bound to what was accepted, by hash or by record ([Social Publishing](../../architecture/social-publishing.md))

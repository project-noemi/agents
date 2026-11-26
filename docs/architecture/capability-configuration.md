# Capability Configuration That Only Subtracts

How to let a deployment switch agents, channels and business units on and off from a settings file, without the file becoming a way to create capability or to fail open. The aim is to let an operator change what runs without a release, while a typo, a truncated file or a missing key can only ever switch something off.

## Overview

- **Code says what can exist. Configuration chooses among it.** A switch can remove a capability and never add one.
- **A tracked default and a deployment overlay**, merged key by key. A key missing from the overlay is inherited from the default, not switched off.
- **A bad file changes nothing.** The last good configuration stays in force, and the problem is reported.
- **Absent means off. Switched on but incomplete means off, loudly.**
- **Identifiers go in configuration; credentials stay in the secret store.**
- **A business unit is another dimension of the same rule**, whether the organisation calls it a unit, a brand, a client or a tenant. Both the platform-wide switch and the unit's own switch must say yes.

## 1. Configuration filters; it never creates

```
enabled(x) = code registers x AND configuration switches x on
```

Setting a channel to `true` does not produce a publisher for it. It produces a status line saying the channel is switched on but nothing can publish to it. Every guard that refuses an unregistered agent or channel keeps the meaning it had, because the only thing the file can do is take something away.

Write this rule at the top of the module that reads the configuration, where the next person reaching for a shortcut will see it. Further conditions, such as an environment mode, join with `AND` and can only subtract too.

## 2. A tracked default and a deployment overlay

Live toggling and a reviewable default contradict each other in one tracked file. Flipping a switch on a production host dirties the working tree, and the next pull conflicts. An untracked file alone has no reviewable default.

- **The tracked file is the safe default.** It changes through review like any other code.
- **The overlay is what a deployment edits.** It is untracked or mounted from the deployment's own configuration, and it is deep-merged over the default key by key, so it can flip one switch without restating the settings it leaves alone.
- **A path override can replace the pair**, for a host that keeps its configuration elsewhere.

Three consequences are easy to get wrong:

- **A key absent from the overlay is inherited, not off.** If the tracked default has a feature switched on and the overlay never mentions it, production runs with it on. Before stating what production runs, render the merged configuration, or read it from the running process's status output. Do not infer it from the overlay alone.
- **Mount the overlay as a single file, not as a directory.** In a container, mounting a configuration directory over the application's config path hides the tracked default that lives in the same directory. Mount only the overlay file at its expected path.
- **Production refuses to start when no overlay was read.** A tracked default is something to review, not a deployment's chosen setup. A process running on the default alone runs a set of capabilities nobody chose for it.

## 3. Fail closed, and stay running

- **A malformed file, an unknown key or a schema violation is refused.** The last good configuration stays in force, the problem is logged, and the status output reports it. An unparseable file must never read as "everything on".
- **A refusal is not a crash.** If configuration is re-read live, a half-saved edit would otherwise take the process down mid-typing.
- **Absent means off.** Adding an agent or a channel to the code does not switch it on. That takes a deliberate line in the tracked file, which is also what makes a truncated file safe.
- **Enabled but incomplete is off, loudly.** A channel switched on without a setting it declares as required is left out of every picker and reported as "switched on but misconfigured", naming the missing key. That is better than a card that looks fine and fails when someone approves it.

## 4. Identifiers in configuration, credentials in the secret store

A topic id, an author id, an API version and a length cap are not secrets. Keeping them beside the switch that uses them means turning a channel on is one edit in one place. Tokens, keys and passwords stay in the secret store, where the secret tooling can reach and rotate them. A configuration file that holds no credentials can be reviewed, diffed and logged freely.

## 5. Decide what is live and what needs a restart

Write down which parts of the configuration take effect immediately, and test them:

| Part | Typical behaviour |
|---|---|
| Channel switches | Live. Read through an accessor that re-checks the file's modification time at most about once a second. Pickers and forms are built each time they open, so a change appears on the next use. |
| A pending approval | Live, checked at the click. The flag is read again when a person approves, and is never copied into the approval record; a record outlives a configuration change. See [Human-Approval Gates](../../guardian-layer/approval-gates.md) §4. |
| A coordinator's specialists | Live, if the framework resolves agent lists and instructions per run. The catalogue is generated from the enabled set, so the coordinator cannot describe or route to an agent that is switched off. See [Coordinator and Specialists](coordinator-specialists.md) §4. |
| The framework's agent registry | Often fixed at startup, and then a change needs a restart. That is acceptable for a rare, deliberate act. |

**Verify the "live" column against the framework version in use. Do not rely on memory of how it behaved.** Whether a framework re-resolves a function-valued setting on every run, or caches it after the first, decides whether a switch is live or quietly needs a restart. Record the version it was checked against, and check again when the version moves.

## 6. Business units are another dimension of the same rule

An organisation that runs the same agent for several business units adds a dimension, not a copy. Depending on the organisation, a unit may be a department, a subsidiary, a brand, a client served by a managed-service provider, or a tenant of a hosted product. Each has its own accounts and its own data, and one unit's work must not go out under another's name. A business unit is a configuration entry: a label, an order, its own account on each channel it uses, and a choice among the source kinds the code supports. Adding one needs a configuration entry, its context file and its secrets, with no code and no prompt edit.

- **Two levels of switches, and both must say yes.** The platform-wide entry for a channel is a kill switch for every unit at once and holds the facts no unit owns, such as an API version. The unit's own entry holds its switch and its identifiers. A channel is usable for a unit only when both are on, the unit is complete, and the channel is fully configured for that unit. An identifier left at the platform level is refused at load, with a message saying where it now belongs.
- **No inheritance of identifiers.** If units inherited identifiers from the platform level, a new unit with a missing setting would quietly publish from the first unit's account. A unit without its own identifier is misconfigured and offers nothing.
- **Every record names its business unit.** Drafts, approval cards, receipts and schedules carry it. A digest over approved content covers the unit, so copy approved for one unit cannot be replayed as another unit's. At the click, the card's unit must match the content's.
- **Records from before units existed are read through one fallback function**, used only for old records and never as a default for new work.
- **No default unit once there are two.** While there is one, work can use it. Once there are two, a helper that returns "the only unit" refuses, and nothing proceeds until a person picks one. Picking the first silently decides whose account a post goes out from.
- **Every unit's secrets follow the same naming rule, the first unit's included.** For example `<NAME>_<UNIT>` for every unit, with no fallback to the old unsuffixed name. A special case for the first unit is what gets copied wrongly when the second is added. When migrating, refuse to start while an old name is still present, so a missed rename fails loudly.
- **Expose the choice last.** Build the model, the records, the credentials and the per-unit sources first, and add the business-unit field to forms and cards last. Until then nothing a person can reach can choose a second unit, so a unit cannot be half-wired in production.

## Example

Copyable files are in [`templates/capability-config/`](../../templates/capability-config/). In short, the tracked default switches every channel off:

```json
{
  "agents":   { "reporter": true, "writer": false },
  "channels": { "social-network": { "enabled": false, "apiVersion": "2026-01" } },
  "units": {
    "unit-a": { "label": "Unit A", "order": 1, "source": "system-of-record",
                "channels": { "social-network": { "enabled": false, "authorId": "" } } },
    "unit-b": { "label": "Unit B", "order": 2, "source": "brief",
                "channels": { "social-network": { "enabled": false, "authorId": "" } } }
  }
}
```

A deployment overlay names only what it changes:

```json
{
  "channels": { "social-network": { "enabled": true } },
  "units": { "unit-a": { "channels": { "social-network": { "enabled": true, "authorId": "author-id-of-unit-a" } } } }
}
```

After the merge, `social-network` is usable for `unit-a` only. `unit-b`'s own switch is still off and it has no identifier, so the platform-wide switch alone does not make it usable. `agents.reporter` stays on, inherited from the default. A JSON Schema for the merged file refuses unknown keys, refuses identifiers at the platform level, and rejects a channel switched on without its identifiers.

## Testing

All of this can be tested without a model call:

| Rule | Test |
|---|---|
| Subtract only | A channel switched on with no registered publisher is reported, not offered. An unregistered agent is refused whatever the file says. |
| Overlay merge | A key absent from the overlay keeps the default's value. A test renders the merged configuration that production would run. |
| Fail closed | Malformed JSON, an unknown key or a schema violation leaves the previous configuration in force and is reported in status. |
| Absent and incomplete | A missing switch is off. A switched-on channel missing a required setting is excluded and reported with the key's name. |
| Re-check at the click | A channel switched off after a card was posted refuses when the card is approved. |
| Business units | A channel is usable only when both switches are on. An identifier at the platform level is refused. With two units, the sole-unit helper refuses. Content approved for one unit cannot be published as another unit's. |
| Secret names | Startup refuses while a pre-migration secret name or token file is still present. |

## Related

- [Coordinator and Specialists](coordinator-specialists.md): generating the coordinator's catalogue from the enabled set.
- [Human-Approval Gates](../../guardian-layer/approval-gates.md): re-checking switches when a person approves.

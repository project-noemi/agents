# Capability Configuration Templates

Starting files for the pattern in [Capability Configuration That Only Subtracts](../../docs/architecture/capability-configuration.md). Copy them into a project and replace the agent, channel and unit names with the ones its code registers.

| File | Role |
|---|---|
| `capabilities.default.json` | The tracked default. Reviewed like code. Every channel is off; an agent that should run everywhere is switched on deliberately. |
| `capabilities.overlay.example.json` | A deployment overlay. Untracked or mounted from the deployment's own configuration. It names only what it changes. |
| `capabilities.schema.json` | A JSON Schema for the **merged** configuration. Unknown keys are refused, and a channel switched on without its identifiers fails validation. |

## How the files combine

The overlay is deep-merged over the default, key by key. A key the overlay does not mention keeps the default's value. It is inherited, not switched off.

With these two files, the merged configuration:

- keeps `agents.reporter` on and `agents.writer` off, from the default;
- switches the `social-network` channel on platform-wide;
- makes `social-network` usable for `unit-a` only, because `unit-a` is switched on and has its own `authorId`;
- leaves `unit-b` off on every channel. The platform-wide switch is on, but `unit-b`'s own switch is not, and it inherits no identifier from `unit-a` or from the platform level;
- leaves `email` off for every unit.

Validate the merged result, not the overlay alone: an overlay is a partial document by design.

## What each part demonstrates

| Rule in the document | Where it shows |
|---|---|
| Configuration only subtracts | The file can name only agents and channels the code registers; it holds switches and identifiers, never code paths. |
| A key absent from the overlay is inherited | `agents.reporter` stays on although the overlay never mentions it. |
| Absent means off | `unit-b` has no `email` entry, so email is off for it. |
| Switched on but incomplete is off | The schema rejects `"enabled": true` with an empty `authorId` or `senderId`. |
| Identifiers in configuration, credentials elsewhere | `authorId`, `senderId`, `maxLength` and `apiVersion` are here; tokens are not. |
| Both switches must say yes | `social-network` needs the platform-wide switch and the unit's switch. |
| No inheritance of identifiers | Platform-level channel entries cannot hold `authorId`; the schema refuses it there. |

`tests/capability-config-template.test.js` checks these statements against the files.

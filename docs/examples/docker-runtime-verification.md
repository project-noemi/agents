# Docker Runtime Verification

This guide documents the real-host verification path for Project NoeMI's Docker examples. It is for the moment when static validation is no longer enough and you need to prove that the local builder home, fleet operator home, and gatekeeper specialist home can actually boot on a Docker-capable machine.

Project NoeMI remains a reference architecture, not a runtime product. This guide verifies the example homes around the repository, not the repository itself as a standalone service.

## What This Verification Proves

The Docker smoke suite checks that the three current example homes:

- parse as valid Compose stacks
- build successfully when images are local-buildable
- reach the expected running-service set
- expose enough runtime health to support operator troubleshooting

The three homes are:

- [`../../examples/docker/`](../../examples/docker/)
- [`../../examples/fleet-deployment/`](../../examples/fleet-deployment/)
- [`../../examples/gatekeeper-deployment/`](../../examples/gatekeeper-deployment/)

## Prerequisites

You need:

- Docker CLI
- Docker Compose
- Node.js 24.x LTS or newer
- enough local CPU, RAM, and disk to boot the example stacks

Before the runtime tier, run the fast gate:

```bash
bash scripts/verify-env.sh --mode=docker
node scripts/generate_all.js
npm run validate
```

Then run the Docker tier:

```bash
npm run test:e2e
```

## Diagnostics on Failure

When the Docker smoke suite fails on a real host, it now writes diagnostics under:

```text
test-artifacts/docker-smoke/
```

Each failing stack gets its own directory with:

- environment variable keys used for the run
- compose config output
- compose ps output
- compose logs output
- command failure output when `config` or `up` fails

These artifacts are intentionally key-only and avoid writing secret values.

## GitHub Actions Path

The repository's validation workflow already runs the Docker smoke suite on `ubuntu-latest` and uploads the diagnostics artifact automatically on failure.

That means the standard verification loop is:

1. run `npm run validate` locally
2. run `npm run test:e2e` locally on a Docker-capable host when you can
3. use the GitHub Actions `docker-smoke-diagnostics` artifact when CI is the first place the runtime issue appears

## How to Interpret Failure

### `config` failure

This usually means:

- missing required env vars
- invalid Compose syntax
- a changed service name that no longer matches the test contract

### `up` failure

This usually means:

- image build failure
- startup command failure
- unsupported host dependency
- bad runtime env wiring

### runtime failure after `up`

This usually means:

- a service never became healthy
- the stack booted but one required service crashed
- the expected running-service list no longer matches the real topology

## Recommended Working Rhythm

Use this sequence when changing Docker-facing examples:

```bash
npm run validate
npm run test:e2e
```

If `npm run test:e2e` fails on a Docker host:

1. inspect `test-artifacts/docker-smoke/`
2. fix the failing example or its test contract
3. rerun `npm run test:e2e`
4. confirm CI also passes the Docker tier

## What This Guide Does Not Do

- it does not certify the stacks for production
- it does not replace environment-specific hardening
- it does not validate live GitHub, Slack, InfluxDB, or vault integrations end to end

It gives the repository a repeatable, operator-friendly way to verify that the documented example homes still boot and behave like the reference architecture says they should.

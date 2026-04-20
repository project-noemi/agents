# Cross-Platform Kickstart

This is the decision point for the beginner builder path.

Do not start by copying the first command block you see. Start by matching the repository path to the machine architecture you actually use day to day.

## Choose Your Workstation Path First

| If your main machine is | Follow this guide | Why this is the right path |
|-------------------------|-------------------|----------------------------|
| macOS or Linux | [`macos-linux-kickstart.md`](macos-linux-kickstart.md) | Native terminal path with the fewest surprises for local-first AI work |
| Windows | [`windows-kickstart.md`](windows-kickstart.md) | PowerShell-first path that avoids Bash assumptions |
| ChromeOS | [`chromeos-kickstart.md`](chromeos-kickstart.md) | Starts inside the Linux development environment, then follows the local-first path |

All three guides follow the same logic:

1. verify only the tools you actually need
2. generate the current repository context
3. prove one safe, read-only first win
4. add secrets only when business systems enter the picture
5. move to Docker later, not first

## Choose Your Docker Host Path Later

The Docker phase is a second decision point, not part of the initial beginner success.

| If your Docker-capable host is | Recommended path |
|--------------------------------|------------------|
| macOS or Linux | Run the Docker phase locally after the beginner path works |
| Windows | Use Docker Desktop and the PowerShell-based Docker path |
| ChromeOS | Usually use a stronger Linux, macOS, or Windows host for the Docker phase |

## Common Rule

The first win should be:

- local
- read-only
- easy to verify with your own eyes
- free of production credentials

That is why Project NoeMI separates:

- workstation choice
- secure local-first work
- business-system integration
- Docker runtime homes

## Recommended Order

1. [`zero-to-first-agent.md`](zero-to-first-agent.md)
2. one workstation guide:
   [`macos-linux-kickstart.md`](macos-linux-kickstart.md), [`windows-kickstart.md`](windows-kickstart.md), or [`chromeos-kickstart.md`](chromeos-kickstart.md)
3. [`../tool-usages/secure-secret-management.md`](../tool-usages/secure-secret-management.md)
4. [`builder-first-30-minutes.md`](builder-first-30-minutes.md)
5. [`docker-agent-home.md`](docker-agent-home.md)

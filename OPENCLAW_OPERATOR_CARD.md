# OpenClaw Operator Card

This is a recognition guide, not a memorization test. Each command below was used or verified during the disposable Lume VM walkthrough.

## System path

```text
Mac → Lume VM → OpenClaw Gateway → agent → session → model → tool → VM operating system
```

## Reconnect to the VM

Run on the Mac:

```bash
ssh clawstopher@"$(lume get openclaw --format json | jq -r '.[0].ipAddress')"
```

## Check the Gateway before changing anything

Run inside the VM:

```bash
openclaw gateway status --require-rpc
lsof -nP -iTCP:18789 -sTCP:LISTEN
openclaw logs --limit 80 --plain
```

Interpretation:

- `Read probe: ok` means the CLI reached the Gateway.
- A `LISTEN` row means a process owns the configured port.
- Logs provide evidence about startup, shutdown, and failures.

## Start the current manual Gateway

Run in a dedicated VM terminal and leave it open:

```bash
openclaw gateway --port 18789
```

Expected completion state:

```text
[gateway] ready
```

Stop it with `Ctrl-C`. This stops the process. It does not delete configuration, authentication, workspaces, or stored sessions.

## Open the Gateway-backed TUI

Run in another VM terminal:

```bash
openclaw tui
```

## Inspect persisted state

```bash
openclaw sessions --limit 10
sed -n '1,10p' "$HOME/.openclaw/workspace/FIRST_CONTROLLED_TASK.md"
```

The session store and workspace files remain on the VM disk after the Gateway stops.

The stable session key can point to a new internal session ID after a lifecycle reset. The installed 2026.7.1-2 build applies an implicit daily reset at 4:00 AM when no reset setting exists. Current OpenClaw `main` changed the default to no automatic reset after this installed build.

## Inspect the current safety posture

```bash
openclaw config validate
openclaw security audit --deep
openclaw approvals get
openclaw sandbox explain --session agent:main:main
```

Read these as separate layers:

- Tool inventory: what the agent can discover.
- Tool policy: what OpenClaw permits.
- Approvals: which executions require confirmation.
- Sandbox: where execution is isolated.
- VM and macOS permissions: what the operating system ultimately permits.

`config get` reports stored configuration. A missing path does not necessarily reveal the effective default used by the installed version.

## Recovery sequence

When the TUI cannot connect:

1. Run `openclaw gateway status --require-rpc`.
2. Check port 18789 with `lsof`.
3. Read recent OpenClaw logs.
4. Form a hypothesis.
5. Start or restart the manual Gateway only after confirming it is absent or unhealthy.

## Current deployment choices

- OpenClaw runs only inside a disposable VM.
- The Gateway binds to loopback.
- Gateway authentication uses a token.
- mDNS discovery is off.
- The plugin allow list contains only `codex`.
- The Gateway is manual and foreground, not a LaunchAgent.
- The OpenClaw sandbox is off.
- Exec is currently full with approval prompts off.

The VM protects the Mac from most local filesystem changes. It does not reverse actions taken through external accounts or automatically revoke credentials.

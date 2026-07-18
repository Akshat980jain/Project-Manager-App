# DevPilot Local Shell Agent

The local shell agent gives the DevPilot terminal panel a real PTY (interactive shell) on your own machine. It is a standalone Node.js process — completely separate from the DevPilot web app.

---

## How to run

**Prerequisites**: Node.js 18+ and `npm` (or `npx`).

```bash
# From the project root
cd backend
npm install        # first time only
npm start
```

The agent prints a one-time random token to the console, e.g.:

```
┌─────────────────────────────────────────────────────────┐
│            DevPilot Local Shell Agent                   │
│                                                         │
│  Token: a3f9c2b1d4e7f0a8c2b1d4e7f0a8c2b1               │
│                                                         │
│  Paste this token in DevPilot → Terminal → Connect      │
│  Binds to 127.0.0.1 only — not reachable externally     │
└─────────────────────────────────────────────────────────┘

Listening on ws://127.0.0.1:3000
```

---

## Connecting to DevPilot

1. With the agent running, open DevPilot in your browser.
2. Press the **backtick** key (`` ` ``) to open the terminal panel.
3. Click **Connect Local Shell** in the panel header.
4. If it's your first time, a consent notice will appear — read it and click **I understand — Connect**.
5. In the connect dialog, enter:
   - **Host**: `127.0.0.1` (default, do not change)
   - **Port**: `3000` (or whatever you set `AGENT_PORT` to)
   - **Token**: paste the token printed in the agent console
6. Click **Connect**. The terminal switches to **Local Shell** mode and you have a real interactive shell.

---

## Security model

| Property | Detail |
|---|---|
| **Localhost only** | The agent binds `127.0.0.1` — never `0.0.0.0`. It is unreachable from any other machine, even on your LAN. |
| **Token auth** | A new random 128-bit token (`crypto.randomBytes(16)`) is generated every time the process starts. Any WebSocket connection that does not supply the correct token is immediately rejected (close code 4401). |
| **Token never persisted** | The token is printed only to stdout. It is never written to a file, sent to any server, or included in any log. |
| **Shell access** | Connecting grants DevPilot the ability to run any command as your local user. **Stop the agent process to immediately revoke all access.** |
| **No inbound ports** | Closing the terminal panel disconnects the WebSocket; no shell process survives after the PTY is killed. |

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `AGENT_PORT` | `3000` | Port to bind to (localhost only) |
| `SHELL` | System default | Shell to spawn on non-Windows systems |

Example with a custom port:

```bash
AGENT_PORT=9999 npm start
```

Then set **Port** to `9999` in the DevPilot connect dialog.

---

## Message protocol (WebSocket JSON)

| Direction | Message shape | Meaning |
|---|---|---|
| Client → Agent | `{ type: "input", data: string }` | Keystroke(s) to send to the PTY |
| Client → Agent | `{ type: "resize", cols: number, rows: number }` | Terminal resize event |
| Agent → Client | `{ type: "output", data: string }` | PTY output (may include ANSI codes) |
| Agent → Client | `{ type: "exit", exitCode: number }` | Shell process exited |

The agent also accepts legacy raw string messages (no JSON wrapper) for backward compatibility with the previous protocol.

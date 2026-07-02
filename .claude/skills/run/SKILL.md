---
name: run
description: Launch the CivCardGame Vite dev server so the user can test a change in the browser. Use whenever asked to run, start, or check on the app. Checks for an already-running dev server (possibly left over from a previous session) before starting a new one.
---

# Run: CivCardGame dev server

This project has no test runner for the UI — the workflow is: start the Vite dev
server, hand the URL to the user, and let them test manually (no Playwright, no
screenshots — see project memory on this).

Vite has no fixed port here (`vite.config.ts` sets no `server.port`), so it binds
5173 and bumps upward (5174, 5175, ...) if that's taken.

## Steps

1. **Check before launching.** A dev server started in a *previous* session may
   still be alive — a new session has no memory of it, but the OS does. Probe
   the default port and a couple of fallbacks:

   ```powershell
   5173..5176 | ForEach-Object {
     if (Get-NetTCPConnection -LocalPort $_ -State Listen -ErrorAction SilentlyContinue) {
       Write-Output "port $_ is listening"
     }
   }
   ```

   (Bash equivalent: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5173` etc.)

2. **If a port is already listening**, don't start another instance — just tell
   the user the app is already up at that `http://localhost:<port>` and hand
   that URL back.

3. **If nothing is listening**, launch it in the background:

   ```
   npm run dev
   ```

   Read the actual bound port from the launch output (don't assume 5173 — Vite
   bumps it if the default is taken) and report that URL to the user. Use the
   **Read tool** on the background task's output file to check this — don't
   build a Bash `grep`/`until` loop against the Windows-style (`C:\Users\...`)
   output path. Git Bash silently fails to match against backslash paths
   (they get mangled by shell escaping), so a wait loop like
   `until grep -q "Local:" "C:\Users\...\task.output"; do sleep 0.5; done`
   spins forever even after the server is ready — it looks like a hang, not
   an error. If you must use Bash instead of Read, convert to the POSIX form
   first (`/c/Users/...`).

4. Let the user drive the browser and test manually — don't try to screenshot
   or automate the UI yourself unless explicitly asked.

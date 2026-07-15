// PreToolUse guard: chrome-devtools MCP calls belong in the `ui-check` subagent, not the
// main session. Wired to the `^mcp__chrome-devtools__` matcher in .claude/settings.json.
//
// Gate on `agent_id`, not `agent_type`: agent_type is also set for a main session started
// with `--agent`, which would read as a subagent and open the hole this closes. agent_id is
// documented as present *only* inside a subagent call.

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  raw += chunk;
});
process.stdin.on('end', () => {
  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    // Fail open. This routes work to the right place; it isn't a security boundary, so an
    // unreadable payload should cost a nudge, not every devtools call in the session.
    process.exit(0);
  }

  if (typeof input.agent_id === 'string' && input.agent_id.length > 0) {
    // Exit silently rather than replying "allow" — an explicit allow would also skip the
    // normal permission prompt, granting the subagent more than this guard is asked to.
    process.exit(0);
  }

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'deny',
        permissionDecisionReason:
          `${input.tool_name ?? 'chrome-devtools'} is not available in the main session. ` +
          'Browser checks run in the `ui-check` subagent so their screenshots and DOM ' +
          'snapshots stay out of this context: invoke the `visual-check` skill, or spawn ' +
          '`ui-check` directly with a concrete checklist.',
      },
    }),
  );
  process.exit(0);
});

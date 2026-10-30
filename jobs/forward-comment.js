// Example: forward a PR comment into the AI agent that owns the PR, via the
// `agents` CLI. Fires only when it's a PR comment, the PR author matches
// config.pr_author, and the commenter is in config.allow.
//
// The owning agent is resolved by `agents ls --json --meta pr=<N>`, falling
// back to a `pr-<N>-` name prefix under ~/.agents for agents without meta.
//
// Set FORGE_DRY_RUN=1 to log instead of sending.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const AGENTS_HOME = path.join(os.homedir(), '.agents');

function jsonl(s) {
  return (s || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = async (ctx) => {
  const c = ctx.config || {};
  const { comment, issue } = ctx.payload;

  if (!issue || !issue.pull_request) return; // PR comments only
  const n = issue.number;
  const author = ((issue.user && issue.user.login) || '').toLowerCase();
  const who = (ctx.sender || '').toLowerCase();

  if (c.pr_author && author !== String(c.pr_author).toLowerCase()) return;
  const allow = (c.allow || []).map((s) => String(s).toLowerCase());
  if (allow.length && !allow.includes(who)) {
    ctx.log(`PR #${n} comment by ${who}: not in allow list — ignored`);
    return;
  }

  // Resolve owning agent(s): meta query first, then name prefix.
  const q = await ctx.run('agents', ['ls', '--json', '--meta', `pr=${n}`]);
  let names = jsonl(q.stdout).map((o) => o.name).filter(Boolean);
  if (!names.length) {
    try {
      names = fs.readdirSync(AGENTS_HOME).filter((d) => d.startsWith(`pr-${n}-`));
    } catch {
      names = [];
    }
  }

  const live = [];
  for (const name of names) {
    const w = await ctx.run('agents', ['whois', '--json', name]);
    try {
      if (JSON.parse(w.stdout).live) live.push(name);
    } catch {
      /* not live */
    }
  }
  if (!live.length) {
    ctx.log(`PR #${n} comment by ${who}, but no live agent — nothing to forward`);
    return;
  }

  const msg =
    `[GitHub comment on PR #${n} from @${ctx.sender}]\n` +
    `${(comment.body || '').trim()}\n\n(${comment.html_url})`;

  for (const name of live) {
    if (process.env.FORGE_DRY_RUN === '1') {
      ctx.log(`DRY-RUN would: agents send ${name} <comment> --from github:${who}`);
      continue;
    }
    const r = await ctx.run('agents', ['send', name, msg, '--from', `github:${who}`]);
    ctx.log(`forwarded PR #${n} comment to ${name} -> exit ${r.code}`);
  }
};

// Example: when an issue is assigned to a given login, spin up an AI agent for
// it with the `agents` CLI, routed to a lead by label. Driven entirely by this
// route's `config:` in forge.yml.
//
// Set FORGE_DRY_RUN=1 to log the intended `agents` command instead of running it.
'use strict';

function slug(s) {
  return (
    (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'issue'
  );
}

module.exports = async (ctx) => {
  const c = ctx.config || {};
  const issue = ctx.payload.issue;
  const assignee = ((ctx.payload.assignee && ctx.payload.assignee.login) || '').toLowerCase();

  if (c.assignee && assignee !== String(c.assignee).toLowerCase()) {
    ctx.log(`issue #${issue.number} assigned to ${assignee || '?'} — not ${c.assignee}, ignored`);
    return;
  }

  const labels = (issue.labels || []).map((l) => l.name).join(' ');
  const text = `${issue.title} ${issue.body || ''} ${labels}`;
  let lead = c.default_lead;
  for (const r of c.route || []) {
    if (r.label && (new RegExp(r.label, 'i').test(labels) || new RegExp(r.label, 'i').test(text))) {
      lead = r.lead;
      break;
    }
  }

  const name = `issue-${issue.number}-${slug(issue.title)}`;
  const args = ['register', name];
  if (c.type) args.push('--type', c.type);
  if (lead) args.push('-t', lead);
  args.push('--meta', `issue=${issue.number}`);
  if (c.project) args.push('--meta', `project=${c.project}`);
  args.push('--prompt', `Work issue #${issue.number}: ${issue.title}\n${issue.html_url}`);

  ctx.log(`issue #${issue.number} -> agent ${name}${lead ? ` under ${lead}` : ''}`);

  if (process.env.FORGE_DRY_RUN === '1') {
    ctx.log(`DRY-RUN would: agents ${args.join(' ')} ; agents up ${name} -d`);
    return;
  }

  let r = await ctx.run('agents', args);
  ctx.log(`register ${name} -> exit ${r.code}${r.stderr ? ': ' + r.stderr.trim() : ''}`);
  if (r.code === 0) {
    r = await ctx.run('agents', ['up', name, '-d']);
    ctx.log(`up ${name} -> exit ${r.code}${r.stderr ? ': ' + r.stderr.trim() : ''}`);
  }
};

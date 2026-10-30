// Recipe: CI failed on a PR.
// Subscribe to the `check_run` event (add it to events: in forge.yml). It fires
// on check_run.completed; `conclusion` is the pass/fail result and
// `pull_requests` lists the PRs the run belongs to. (The `workflow_run` and
// `check_suite` events work the same way if you prefer those.)
//
// Route: check_run.completed
'use strict';

module.exports = async (ctx) => {
  const cr = ctx.payload.check_run;
  if (!cr || cr.conclusion !== 'failure') return; // only act on failures

  const prs = (cr.pull_requests || []).map((p) => `#${p.number}`).join(', ') || '(no PR)';
  ctx.log(`CI "${cr.name}" failed on ${prs} — ${cr.html_url}`);

  // e.g. ping the PR, or forward to the owning agent:
  // await ctx.gh(['pr', 'comment', String(cr.pull_requests[0].number),
  //   '--repo', ctx.repo, '--body', `CI "${cr.name}" failed: ${cr.html_url}`]);
};

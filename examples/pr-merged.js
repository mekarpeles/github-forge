// Recipe: a PR was merged (not merely closed).
// There is no "merged" action — GitHub fires pull_request.closed and sets
// payload.pull_request.merged to true only when it was actually merged.
//
// Route: pull_request.closed
'use strict';

module.exports = async (ctx) => {
  const pr = ctx.payload.pull_request;
  if (!pr.merged) {
    ctx.log(`PR #${pr.number} closed without merging`);
    return;
  }
  ctx.log(`PR #${pr.number} merged into ${pr.base.ref} by ${ctx.sender}`);
};

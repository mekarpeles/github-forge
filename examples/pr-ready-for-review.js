// Recipe: a PR was moved out of draft.
// GitHub fires pull_request.ready_for_review for exactly this transition.
//
// Route: pull_request.ready_for_review
'use strict';

module.exports = async (ctx) => {
  const pr = ctx.payload.pull_request;
  ctx.log(`PR #${pr.number} is out of draft / ready for review: ${pr.title}`);
};

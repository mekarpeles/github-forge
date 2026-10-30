// Recipe: a comment was made on an issue OR a pull request.
// GitHub sends both as issue_comment.created; a PR comment carries
// issue.pull_request, which is how you tell them apart.
//
// Route: issue_comment.created
'use strict';

module.exports = async (ctx) => {
  const { issue, comment } = ctx.payload;
  const kind = issue.pull_request ? 'PR' : 'issue';
  ctx.log(`${kind} #${issue.number} comment by ${ctx.sender}: ${(comment.body || '').slice(0, 80)}`);
};

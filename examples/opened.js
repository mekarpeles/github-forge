// Recipe: an issue or a PR was opened.
// Wire both routes to this one job; ctx.event tells them apart.
//
// Routes: issues.opened, pull_request.opened
'use strict';

module.exports = async (ctx) => {
  const obj = ctx.payload.issue || ctx.payload.pull_request;
  const kind = ctx.event === 'pull_request' ? 'PR' : 'issue';
  ctx.log(`${kind} #${obj.number} opened by ${ctx.sender}: ${obj.title}`);
};

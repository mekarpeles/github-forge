// Recipe: a label was added or removed on an issue or a PR.
// Wire this one job to all four routes below. ctx.event distinguishes
// issue vs PR; ctx.action distinguishes added (labeled) vs removed (unlabeled);
// payload.label is the label that changed.
//
// Routes: issues.labeled, issues.unlabeled,
//         pull_request.labeled, pull_request.unlabeled
'use strict';

module.exports = async (ctx) => {
  const obj = ctx.payload.issue || ctx.payload.pull_request;
  const kind = ctx.event === 'pull_request' ? 'PR' : 'issue';
  const verb = ctx.action === 'labeled' ? 'added to' : 'removed from';
  const label = ctx.payload.label && ctx.payload.label.name;
  ctx.log(`label "${label}" ${verb} ${kind} #${obj.number}`);
};

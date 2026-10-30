// The default "is it working?" job: append every event to logs/events.jsonl.
'use strict';

const fs = require('fs');
const path = require('path');
const LOG_DIR = path.join(__dirname, '..', 'logs');

module.exports = async (ctx) => {
  const p = ctx.payload;
  const obj = p.issue || p.pull_request || {};
  const rec = {
    at: new Date().toISOString(),
    event: ctx.event,
    action: ctx.action || null,
    repo: ctx.repo,
    sender: ctx.sender,
    number: obj.number || null,
    title: obj.title || null,
  };
  ctx.log(
    `${rec.event}${rec.action ? '.' + rec.action : ''}` +
      `${rec.number ? ' #' + rec.number : ''} by ${rec.sender}`
  );
  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    fs.appendFileSync(path.join(LOG_DIR, 'events.jsonl'), JSON.stringify(rec) + '\n');
  } catch (err) {
    ctx.log('could not write log —', err.message);
  }
};

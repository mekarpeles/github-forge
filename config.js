'use strict';

// Loads forge.yml — the declaration of what webhooks we watch and how we
// respond. No secrets live here; ${VAR} is filled from the environment so you
// can reference e.g. ${FORGE_REPO} without committing anything sensitive.

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const CONFIG_PATH = process.env.FORGE_CONFIG || path.join(__dirname, 'forge.yml');

function interpolate(v) {
  if (typeof v === 'string') return v.replace(/\$\{(\w+)\}/g, (_, k) => process.env[k] ?? '');
  if (Array.isArray(v)) return v.map(interpolate);
  if (v && typeof v === 'object') for (const k of Object.keys(v)) v[k] = interpolate(v[k]);
  return v;
}

function load() {
  const cfg = interpolate(yaml.load(fs.readFileSync(CONFIG_PATH, 'utf8')) || {});
  cfg.repo = process.env.FORGE_REPO || cfg.repo || '';
  cfg.events = cfg.events || [];
  cfg.routes = cfg.routes || [];
  return cfg;
}

module.exports = { load, CONFIG_PATH };

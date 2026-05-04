'use strict';
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '..', 'notification_templates');
const cache = {};

function load(locale) {
  if (cache[locale]) return cache[locale];
  const fp = path.join(TEMPLATES_DIR, `${locale}.json`);
  if (!fs.existsSync(fp)) return null;
  cache[locale] = JSON.parse(fs.readFileSync(fp, 'utf8'));
  return cache[locale];
}

function interpolate(str, vars) {
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`,
  );
}

function render(type, locale = 'en', vars = {}) {
  const primary = load(locale) || load('en');
  if (!primary || !primary[type]) {
    throw new Error(`Unknown notification template: ${type}`);
  }
  const t = primary[type];
  return {
    title: interpolate(t.title || '', vars),
    body: interpolate(t.body || '', vars),
  };
}

module.exports = { render };

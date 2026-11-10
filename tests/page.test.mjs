// Checks on the page as a whole: the engine files are the pinned upstream ones, every text the
// page asks for exists, a plan written here is valid maDMP and keeps the IT:U affiliation, and
// the page's policy and links stay on its own origin. Run with: node --test tests/*.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFileSync(root + p, 'utf8');

const { en } = await import('../src/i18n/en.js?v=21');
const { t } = await import('../src/i18n/index.js?v=21');
const { QUESTION_IDS, DATASET_FIELDS } = await import('../src/requirements.js?v=21');
const P = await import('../src/plan.js?v=21');
const { createItuPlan, ITU_AFFILIATION } = await import('../src/itu.js?v=1');

const html = read('index.html');
const app = read('src/app.js');

/** Files copied from Actionable DMP at commit 86eff52, with the SHA-256 they had there. */
const UPSTREAM = JSON.parse(read('tests/upstream.lock.json'));

test('the engine files are byte for byte the upstream ones', () => {
  for (const [file, sha] of Object.entries(UPSTREAM.files))
    assert.equal(createHash('sha256').update(readFileSync(root + file)).digest('hex'), sha, file);
});

test('the questions, section titles and guidance are the ones of Actionable DMP, word for word', () => {
  const keys = Object.keys(en).filter((k) => /^(sec\.|q\.)/.test(k)).sort();
  const sha = createHash('sha256').update(keys.map((k) => `${k}\n${en[k]}`).join('\n\n')).digest('hex');
  assert.equal(sha, UPSTREAM.quoted_strings_sha256);
});

function keysUsed() {
  const used = new Set();
  for (const m of html.matchAll(/data-i18n(?:-html)?="([^"]+)"/g)) used.add(m[1]);
  for (const m of html.matchAll(/data-i18n-attr="([^"]+)"/g))
    for (const pair of m[1].split(';')) used.add(pair.split(':')[1].trim());
  for (const src of [app, read('src/plan.js'), read('src/jsonschema.js')])
    for (const m of src.matchAll(/'((?:plan|md|he|val|about|nav|ui|ds|opt|q|sec|field|col|foot|meta)\.[A-Za-z0-9_.]*[A-Za-z0-9_])'/g)) used.add(m[1]);
  for (const id of QUESTION_IDS) { used.add(`q.${id}`); used.add(`q.${id}.guide`); }
  for (const f of DATASET_FIELDS.filter((x) => x.tier === 'core')) if (f.type !== 'licence') used.add(`field.${f.key}`);
  return used;
}

test('every text the page asks for is in the catalogue', () => {
  const missing = [...keysUsed()].filter((k) => !(k in en));
  assert.deepEqual(missing, []);
});

test('no text carries an em dash, in the catalogue or in the files written for this page', () => {
  const dash = String.fromCharCode(0x2014);
  for (const [k, v] of Object.entries(en)) assert.ok(!v.includes(dash), k);
  for (const f of ['index.html', 'src/app.js', 'src/itu.js', 'src/theme-boot.js', 'style.css', 'README.md', 'NOTICE', 'CHANGELOG.md'])
    assert.ok(!read(f).includes(dash), f);
});

function filledPlan() {
  const plan = createItuPlan();
  plan.dmp.title = 'Data Management Plan for a test project';
  Object.assign(plan.dmp.contact, { name: 'Test Person', mbox: 'test@example.org' });
  plan.dmp.contact.contact_id = { identifier: 'https://orcid.org/0000-0002-1825-0097', type: 'orcid' };
  plan.dmp.dataset[0].title = 'Survey responses';
  for (const id of QUESTION_IDS) plan.dmp.actionable_dmp.answers[id] = `Answer to ${id}.`;
  return plan;
}

test('a new plan names IT:U, with its ROR ID, as the affiliation of the contact', () => {
  const plan = createItuPlan();
  assert.deepEqual(plan.dmp.contact.affiliation, [ITU_AFFILIATION]);
  assert.equal(ITU_AFFILIATION.affiliation_id.identifier, 'https://ror.org/03jzk4720');
  assert.equal(ITU_AFFILIATION.affiliation_id.type, 'ror');
});

test('a filled plan has no errors, and its dmp.json keeps the affiliation', () => {
  const plan = filledPlan();
  assert.deepEqual(P.validatePlan(plan).filter((p) => p.severity === 'error'), []);
  const round = P.parsePlan(P.planToJson(plan));
  assert.equal(round.error, undefined);
  assert.deepEqual(round.plan.dmp.contact.affiliation, [ITU_AFFILIATION]);
  assert.deepEqual(P.validatePlan(round.plan).filter((p) => p.severity === 'error'), []);
});

test('an empty plan is reported as not valid', () => {
  const codes = P.validatePlan(createItuPlan()).filter((p) => p.severity === 'error').map((p) => p.path);
  assert.ok(codes.includes('dmp.title'));
  assert.ok(codes.includes('dmp.contact.mbox'));
});

test('both documents carry every answer and no untranslated key', () => {
  const plan = filledPlan();
  for (const options of [undefined, { layout: 'horizon' }]) {
    const md = P.planToMarkdown(plan, t, options);
    for (const id of QUESTION_IDS) assert.ok(md.includes(`Answer to ${id}.`), `${id} ${options?.layout ?? 'science europe'}`);
    assert.doesNotMatch(md, /\b(?:md|he|q|sec|field|opt|val|col)\.[a-z0-9_]+(?:\.[a-z0-9_]+)*\b(?!\.\w)/i);
  }
  assert.match(P.planToMarkdown(plan, t, { layout: 'horizon' }), /^## 1\. Data summary$/m);
});

test('the ten RDA examples open', () => {
  const files = readdirSync(root + 'tests/fixtures/rda').filter((f) => f.endsWith('.json'));
  assert.equal(files.length, 10);
  for (const f of files) {
    const parsed = P.parsePlan(read(`tests/fixtures/rda/${f}`));
    assert.equal(parsed.error, undefined, f);
    assert.ok(P.editable(parsed.plan).dmp.dataset.length >= 1, f);
  }
});

test('the policy allows only the page itself, and nothing in the page points elsewhere', () => {
  const csp = /http-equiv="Content-Security-Policy" content="([^"]+)"/.exec(html)[1].replace(/\s+/g, ' ').trim();
  assert.match(csp, /^default-src 'none';/);
  for (const banned of ['connect-src', 'unsafe-inline', 'unsafe-eval', 'http:', 'https:', '*'])
    assert.ok(!csp.includes(banned), banned);
  for (const m of html.matchAll(/<(?:script|link|img)\b[^>]*\b(?:src|href)="([^"]+)"/g))
    assert.match(m[1], /^(?:\.\/|data:)/, m[1]);
  assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)/, 'an inline script');
  assert.doesNotMatch(html, /\sstyle="/, 'an inline style');
  for (const f of ['src/app.js', 'src/itu.js', 'src/theme-boot.js'])
    assert.doesNotMatch(read(f), /\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket|EventSource|import\(/, f);
  assert.doesNotMatch(read('style.css'), /url\(|@import/);
});

test('a module is always imported under the same address', () => {
  // Module identity is by URL: the same file under two addresses would be loaded twice,
  // and the language set in one copy would not reach the other.
  const seen = new Map();
  const files = ['src/app.js', 'src/itu.js', 'src/plan.js', 'src/requirements.js', 'src/jsonschema.js', 'src/madmp-schema.js', 'src/i18n/index.js'];
  for (const f of files)
    for (const m of read(f).matchAll(/from '(\.[^']+)'/g)) {
      const file = new URL(m[1], `file:///${f}`).pathname.split('?')[0];
      const spec = m[1].split('?')[1] ?? '';
      if (seen.has(file)) assert.equal(spec, seen.get(file), `${file} imported in ${f}`);
      else seen.set(file, spec);
      assert.ok(readFileSync(root + file.slice(1)), file);
    }
  assert.ok(seen.size >= 6);
});

test('every element the script looks up is on the page', () => {
  const ids = new Set([...app.matchAll(/\$\('([a-z0-9-]+)'\)/g)].map((m) => m[1]));
  assert.ok(ids.size > 10);
  for (const id of ids) assert.ok(html.includes(`id="${id}"`), id);
});

test('the page offers no field the trimmed catalogue cannot label', () => {
  for (const m of html.matchAll(/data-bind="([^"]+)"/g)) assert.ok(m[1].length > 0);
  assert.ok(!html.includes('dmp_id'), 'the plan identifier is not a field of this page');
});

test('the version on the page is the version of the release', () => {
  const page = /<span id="version">([^<]+)<\/span>/.exec(html)[1];
  assert.equal(page, /^version: "?([^"\n]+)"?$/m.exec(read('CITATION.cff'))[1]);
  assert.ok(read('CHANGELOG.md').includes(`## ${page}`));
});

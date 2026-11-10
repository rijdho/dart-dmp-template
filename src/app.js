// The page: it moves values between the form and the plan. What a plan is, what it must
// contain and how it is written out are decided in requirements.js and plan.js, which come
// unchanged from Actionable DMP; itu.js adds the IT:U affiliation to a new plan. The page makes
// no network request.

import { DATASET_FIELDS, LICENCES, PLAN_FIELDS, QUESTIONS, QUESTION_IDS, SECTIONS, requiredQuestions } from './requirements.js?v=21';
import {
  completeness, createDataset, editable, fieldValue, funderIdType, licenceKey, parsePlan, planToJson, planToMarkdown,
  setFieldValue, stamp, validatePlan,
} from './plan.js?v=21';
import { createItuPlan } from './itu.js?v=1';
import { LANGS, getLang, resolveLang, setLang, t } from './i18n/index.js?v=21';

const $ = (id) => document.getElementById(id);
const KEY = { draft: 'dart-dmp-template:draft', theme: 'dart-dmp-template:theme' };

const VIEWS = ['plan', 'about'];
const VIEW_TITLE = { plan: 'nav.plan', about: 'about.title' };

/** The dataset fields this page shows: the core ones. The optional detail is not offered here. */
const CORE_FIELDS = DATASET_FIELDS.filter((f) => f.tier === 'core');

let view = 'plan';
let plan = loadDraft() ?? createItuPlan();
let confirmNew = false;
let confirmRemove = null;

const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ── storage: a convenience of this browser, never needed for the page to work ──

function loadDraft() {
  try {
    const raw = localStorage.getItem(KEY.draft);
    const parsed = raw ? parsePlan(raw).plan : null;
    return parsed ? editable(parsed) : null;
  } catch {
    return null;
  }
}

let saveTimer = null;
function saveDraft() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(KEY.draft, JSON.stringify(plan)); } catch { /* storage unavailable */ }
  }, 300);
}

// ── views, language and theme ────────────────────────────────────────────────

function showView(next) {
  view = VIEWS.includes(next) ? next : 'plan';
  for (const node of document.querySelectorAll('.view')) node.hidden = node.dataset.view !== view;
  for (const b of document.querySelectorAll('.nav-item')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  $('cmd-title').textContent = t(VIEW_TITLE[view]);
}

function applyI18n() {
  document.documentElement.lang = getLang();
  for (const node of document.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
  for (const node of document.querySelectorAll('[data-i18n-html]')) node.innerHTML = t(node.dataset.i18nHtml);
  for (const node of document.querySelectorAll('[data-i18n-attr]'))
    for (const pair of node.dataset.i18nAttr.split(';')) {
      const [attr, key] = pair.split(':');
      if (attr && key) node.setAttribute(attr.trim(), t(key.trim()));
    }
  $('cmd-title').textContent = t(VIEW_TITLE[view]);
  renderAll();
}

function initLang() {
  // One language needs no switch; the place for it stays in the top-right corner.
  $('lang').hidden = LANGS.length < 2;
  setLang(resolveLang(null, navigator.languages ?? [navigator.language]));
}

function initTheme() {
  $('theme').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme
      ? document.documentElement.dataset.theme === 'dark'
      : matchMedia('(prefers-color-scheme: dark)').matches;
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY.theme, next); } catch { /* storage unavailable */ }
  });
}

// ── the plan and its project ─────────────────────────────────────────────────

const getPath = (obj, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);

function setPath(obj, path, value) {
  const keys = path.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] == null || typeof o[k] !== 'object') o[k] = {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
}

const options = (values, labelKey, current) =>
  values.map((v) => `<option value="${v}" ${current === v ? 'selected' : ''}>${escapeHtml(t(labelKey(v)))}</option>`).join('');

function renderSelects() {
  $('ethics').innerHTML = options(['yes', 'no', 'unknown'], (v) => `opt.${v}`, plan.dmp.ethical_issues_exist);
  $('funding-status').innerHTML = options(['planned', 'applied', 'granted', 'rejected'], (v) => `opt.funding_status.${v}`,
    plan.dmp.project[0].funding[0].funding_status);
}

function fillMeta() {
  for (const input of document.querySelectorAll('[data-bind]')) input.value = getPath(plan.dmp, input.dataset.bind) ?? '';
}

function onMetaInput(e) {
  const input = e.target.closest('[data-bind]');
  if (!input) return;
  const bind = input.dataset.bind;
  setPath(plan.dmp, bind, input.value);
  const funding = plan.dmp.project[0].funding[0];
  if (bind.endsWith('funder_id.identifier')) funding.funder_id.type = funderIdType(input.value);
  if (bind.endsWith('grant_id.identifier')) funding.grant_id.type = /^https?:\/\//i.test(input.value.trim()) ? 'url' : 'other';
  // Whether there are ethical issues decides whether 4c is required.
  if (bind === 'ethical_issues_exist') renderQuestionCount();
  changed();
}

function changed() {
  plan = stamp(plan);
  saveDraft();
  renderValidity();
}

// ── datasets ─────────────────────────────────────────────────────────────────

const fieldByKey = (key) => DATASET_FIELDS.find((f) => f.key === key);
const placeholder = (key) => (t(key) !== key ? ` placeholder="${escapeHtml(t(key))}"` : '');

function control(fd, value, attrs) {
  const label = escapeHtml(t(`field.${fd.key}`));
  if (fd.type === 'enum') {
    const key = fd.key === 'data_access' ? (v) => `opt.data_access.${v}` : (v) => `opt.${v}`;
    return `<label class="field"><span>${label}</span><select class="input" ${attrs}>${options(fd.options, key, value)}</select></label>`;
  }
  if (fd.type === 'textarea')
    return `<label class="field span2"><span>${label}</span><textarea class="input" rows="2" ${attrs}>${escapeHtml(value)}</textarea></label>`;
  const type = fd.type === 'date' ? 'date' : fd.type === 'url' ? 'url' : 'text';
  const wide = fd.key === 'title' ? ' span2' : '';
  return `<label class="field${wide}"><span>${label}</span>
    <input class="input" type="${type}" ${attrs} value="${escapeHtml(value)}" autocomplete="off" spellcheck="false"${placeholder(`field.${fd.key}.ph`)} /></label>`;
}

function dsControl(i, ds, fd) {
  const id = `ds-${i}-${fd.key}`;
  const value = fieldValue(ds, fd);
  const attrs = `id="${id}" data-ds="${i}" data-key="${fd.key}"`;
  if (fd.type === 'licence') {
    const known = LICENCES.find((l) => licenceKey(l.url) === licenceKey(value));
    const opts = [`<option value="">${escapeHtml(t('opt.unset'))}</option>`,
      ...LICENCES.map((l) => `<option value="${escapeHtml(l.url)}" ${known === l ? 'selected' : ''}>${escapeHtml(l.spdx)}</option>`),
      `<option value="other" ${value && !known ? 'selected' : ''}>${escapeHtml(t('opt.licence.other'))}</option>`];
    return `<label class="field"><span>${escapeHtml(t('field.license_ref'))}</span><select class="input" id="${id}-pick" data-ds="${i}" data-licence-pick>${opts.join('')}</select></label>
      <label class="field"><span>${escapeHtml(t('field.license_url'))}</span>
        <input class="input" type="url" ${attrs} value="${escapeHtml(value)}" autocomplete="off" spellcheck="false" /></label>`;
  }
  return control(fd, value, attrs);
}

function datasetCard(ds, i) {
  const extra = (ds.distribution?.length ?? 1) - 1;
  return `<article class="req dataset" id="ds-${i}">
    <header class="ds-h">
      <p class="eyebrow">${escapeHtml(t('ds.untitled', { n: i + 1 }))}</p>
      <button class="btn small danger-quiet" type="button" data-remove="${i}">${escapeHtml(t('plan.datasets.remove'))}</button>
    </header>
    <div class="grid2">${CORE_FIELDS.map((fd) => dsControl(i, ds, fd)).join('')}</div>
    ${extra > 0 ? `<p class="hint">${escapeHtml(t('ds.extra', { n: extra }))}</p>` : ''}
  </article>`;
}

function renderDatasets() {
  confirmRemove = null;
  $('datasets').innerHTML = plan.dmp.dataset.map(datasetCard).join('');
  $('ds-count').textContent = t('plan.datasets.count', { n: plan.dmp.dataset.length });
}

function onDatasetInput(e) {
  const pick = e.target.closest('[data-licence-pick]');
  if (pick) {
    const i = Number(pick.dataset.ds);
    const urlInput = $(`ds-${i}-license_ref`);
    if (pick.value !== 'other') {
      urlInput.value = pick.value;
      setFieldValue(plan.dmp.dataset[i], fieldByKey('license_ref'), pick.value);
      changed();
    } else urlInput.focus();
    return;
  }
  const node = e.target.closest('[data-ds][data-key]');
  if (!node) return;
  const i = Number(node.dataset.ds);
  setFieldValue(plan.dmp.dataset[i], fieldByKey(node.dataset.key), node.value, { language: plan.dmp.language || 'eng' });
  if (node.dataset.key === 'license_ref') {
    const known = LICENCES.find((l) => licenceKey(l.url) === licenceKey(node.value));
    $(`ds-${i}-license_ref-pick`).value = known ? known.url : node.value.trim() ? 'other' : '';
  }
  // Whether a dataset holds personal data decides whether 4a is required.
  if (node.dataset.key === 'personal_data') renderQuestionCount();
  changed();
}

function onDatasetClick(e) {
  const btn = e.target.closest('[data-remove]');
  if (!btn) return;
  const i = Number(btn.dataset.remove);
  // Two clicks instead of a dialog, as for Start over.
  if (confirmRemove !== i) {
    confirmRemove = i;
    btn.textContent = t('plan.datasets.remove.confirm');
    setTimeout(() => { if (confirmRemove === i) { confirmRemove = null; btn.textContent = t('plan.datasets.remove'); } }, 4000);
    return;
  }
  plan.dmp.dataset.splice(i, 1);
  renderDatasets();
  renderQuestionCount();
  changed();
}

function onAddDataset() {
  plan.dmp.dataset.push(editable({ dmp: { dataset: [createDataset()] } }).dmp.dataset[0]);
  renderDatasets();
  renderQuestionCount();
  changed();
  $(`ds-${plan.dmp.dataset.length - 1}-title`)?.focus();
}

// ── the fifteen questions ────────────────────────────────────────────────────

function guideList(id) {
  // One line per bullet; a line starting with › is a sub-bullet of the one before it.
  const items = [];
  for (const line of t(`q.${id}.guide`).split('\n')) {
    if (line.startsWith('› ') && items.length) items.at(-1).subs.push(line.slice(2));
    else items.push({ text: line, subs: [] });
  }
  return `<ul class="guide">${items.map((i) => `<li>${escapeHtml(i.text)}${i.subs.length
    ? `<ul>${i.subs.map((s) => `<li>${escapeHtml(s)}</li>`).join('')}</ul>` : ''}</li>`).join('')}</ul>`;
}

function renderQuestions() {
  const answers = plan.dmp.actionable_dmp.answers;
  $('questions').innerHTML = SECTIONS.map((sec) => `
    <section class="qsection">
      <h3 class="qsection-h"><span class="mono">${sec}</span> ${escapeHtml(t(`sec.${sec}`))}</h3>
      ${QUESTIONS.filter((q) => q.section === sec).map((q) => `
        <article class="req" id="q-${q.id}">
          <p class="eyebrow">${escapeHtml(q.id)}</p>
          <p class="question">${escapeHtml(t(`q.${q.id}`))}</p>
          ${q.id === '4a' || q.id === '4c' ? `<p class="hint when" id="when-${q.id}"></p>` : ''}
          <details class="commit"><summary>${escapeHtml(t('plan.guide.toggle'))}</summary>${guideList(q.id)}</details>
          <label class="field"><span>${escapeHtml(t('plan.answer.label'))}</span>
            <textarea class="input" rows="3" data-q="${q.id}"
              placeholder="${escapeHtml(t('plan.answer.ph'))}">${escapeHtml(answers[q.id] ?? '')}</textarea></label>
        </article>`).join('')}
    </section>`).join('');
  renderQuestionCount();
}

/** The count, and for 4a and 4c whether this plan, as it stands, requires them. */
function renderQuestionCount() {
  const c = completeness(plan);
  $('q-count').textContent = t('plan.questions.count', { a: c.answered, n: c.required });
  const required = requiredQuestions(plan);
  for (const id of ['4a', '4c']) {
    const node = $(`when-${id}`);
    if (node) node.textContent = required.includes(id) ? t(`q.${id}.when`) : `${t(`q.${id}.when`)} ${t('q.notRequired')}`;
  }
}

function onQuestionInput(e) {
  const node = e.target.closest('[data-q]');
  if (!node) return;
  plan.dmp.actionable_dmp.answers[node.dataset.q] = node.value;
  renderQuestionCount();
  changed();
}

// ── validity ─────────────────────────────────────────────────────────────────

/** A field path as validation writes it (`distribution[0].host.url`), for each dataset field. */
const dotted = (path) => path.map((k, i) => (typeof k === 'number' ? `[${k}]` : i ? `.${k}` : k)).join('');
const DS_FIELD_PATH = {
  ...Object.fromEntries(DATASET_FIELDS.map((f) => [dotted(f.path), f.key])),
  'dataset_id.identifier': 'doi', 'distribution[0].license[0].start_date': 'license_ref',
  'distribution[0].host': 'host_url', 'metadata[0]': 'metadata_standard',
};

/** A problem's path in words: the label the visitor sees next to the field, where the page has one. */
function problemLabel(path) {
  const META = {
    'dmp.title': 'plan.title.label', 'dmp.language': 'plan.lang.label', 'dmp.contact': 'plan.contact.label',
    'dmp.contact.name': 'plan.contact.label', 'dmp.contact.mbox': 'plan.mbox.label',
    'dmp.contact.contact_id': 'plan.orcid.label', 'dmp.contact.contact_id.identifier': 'plan.orcid.label',
    'dmp.dmp_id.identifier': 'plan.dmpId.label', 'dmp.ethical_issues_exist': 'plan.ethics.label',
    'dmp.project[0].title': 'plan.project.label', 'dmp.project[0].start': 'plan.start.label', 'dmp.project[0].end': 'plan.end.label',
    'dmp.project[0].funding[0].funder_id.identifier': 'plan.funder.label',
    'dmp.project[0].funding[0].grant_id': 'plan.grant.label', 'dmp.project[0].funding[0].grant_id.identifier': 'plan.grant.label',
    'dmp.dataset': 'plan.datasets.title', 'dmp.modified': 'md.modified', 'dmp.created': 'md.created',
  };
  if (META[path]) return t(META[path]);
  const q = /^dmp\.actionable_dmp\.answers\.(\w+)$/.exec(path);
  if (q && QUESTION_IDS.includes(q[1])) return q[1];
  const pf = /^dmp\.(contributor|cost)\[(\d+)\](?:\.(\w+))?/.exec(path);
  if (pf) return `${t(`field.${pf[1]}`)} ${Number(pf[2]) + 1}${pf[3] ? `: ${pf[3]}` : ''}`;
  const top = PLAN_FIELDS.find((f) => path === `dmp.${f.key}`);
  if (top) return t(`field.${top.key}`);
  const m = /^dmp\.dataset\[(\d+)\](?:\.(.+))?$/.exec(path);
  if (m) {
    const n = t('ds.untitled', { n: Number(m[1]) + 1 });
    const field = m[2] && DS_FIELD_PATH[m[2]];
    return field ? `${n}: ${t(`field.${field}`)}` : m[2] ? `${n}: ${m[2]}` : n;
  }
  return path;
}

function renderValidity() {
  const problems = validatePlan(plan);
  const errors = problems.filter((p) => p.severity === 'error');
  const warnings = problems.filter((p) => p.severity === 'warning');
  const parts = [errors.length ? t('plan.valid.errors', { n: errors.length }) : t('plan.valid.ok')];
  if (warnings.length) parts.push(t('plan.valid.warnings', { n: warnings.length }));
  $('validity').textContent = parts.join(' ');
  $('validity').dataset.state = errors.length ? 'error' : 'ok';
  // An unanswered question is counted in the line below, not listed here.
  const shown = [...errors, ...warnings.filter((w) => w.code !== 'val.unanswered')];
  $('problems').innerHTML = shown.map((p) => `<li class="${p.severity}"><b>${escapeHtml(problemLabel(p.path))}</b> ${escapeHtml(t(p.code, p.vars))}</li>`).join('');
  $('problems').hidden = shown.length === 0;
  const c = completeness(plan);
  $('completeness').textContent = c.complete
    ? t('plan.complete.ok', { n: c.required })
    : t('plan.complete.missing', { a: c.answered, n: c.required, ids: c.missing.join(', ') });
  $('completeness').dataset.state = c.complete ? 'ok' : 'open';
}

// ── files ────────────────────────────────────────────────────────────────────

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function renderAll() {
  renderSelects();
  fillMeta();
  renderDatasets();
  renderQuestions();
  renderValidity();
}

function loadIntoEditor(next) {
  plan = next;
  saveDraft();
  renderAll();
}

async function onImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  const parsed = parsePlan(await file.text());
  if (parsed.error) {
    $('import-status').textContent = t('plan.importFailed', { reason: t(parsed.error) });
    return;
  }
  loadIntoEditor(editable(parsed.plan));
  // The button is at the top and the validity line at the bottom, so say it next to the button.
  $('import-status').textContent = `${t('plan.imported')} ${$('validity').textContent}`;
}

function onNew() {
  // Two clicks instead of a dialog: a plan that was not downloaded cannot be brought back.
  if (!confirmNew) {
    confirmNew = true;
    $('new-plan').textContent = t('plan.new.confirm');
    setTimeout(() => { confirmNew = false; $('new-plan').textContent = t('plan.new'); }, 4000);
    return;
  }
  confirmNew = false;
  $('new-plan').textContent = t('plan.new');
  loadIntoEditor(createItuPlan());
  $('import-status').textContent = '';
}

// ── start ────────────────────────────────────────────────────────────────────

function init() {
  initLang();
  initTheme();
  document.querySelector('.rail nav').addEventListener('click', (e) => {
    const next = e.target.closest('.nav-item')?.dataset.view;
    if (next) showView(next);
  });
  for (const id of ['meta', 'project']) {
    $(id).addEventListener('input', onMetaInput);
    $(id).addEventListener('change', onMetaInput);
  }
  $('datasets').addEventListener('input', onDatasetInput);
  $('datasets').addEventListener('change', onDatasetInput);
  $('datasets').addEventListener('click', onDatasetClick);
  $('add-dataset').addEventListener('click', onAddDataset);
  $('questions').addEventListener('input', onQuestionInput);
  $('dl-json').addEventListener('click', () => download('dmp.json', planToJson(plan), 'application/json'));
  $('dl-md').addEventListener('click', () => download('DMP.md', planToMarkdown(plan, t), 'text/markdown'));
  $('dl-md-he').addEventListener('click', () => download('DMP-horizon-europe.md', planToMarkdown(plan, t, { layout: 'horizon' }), 'text/markdown'));
  $('import-file').addEventListener('change', onImport);
  $('new-plan').addEventListener('click', onNew);
  applyI18n();
  showView('plan');
}

init();

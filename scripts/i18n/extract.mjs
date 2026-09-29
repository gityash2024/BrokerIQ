// Collects user-facing UI strings from web (site, account, broker) and mobile into a catalog.
// Keys are the exact source strings; `${expr}` parts become `{n}` placeholders.
// Usage: node scripts/i18n/extract.mjs  → scripts/i18n/catalog.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ts = require(path.resolve('node_modules/typescript'));

const ROOTS = [
  ['apps/web/src', (f) => !f.includes('/app/admin/') && !f.includes('/components/admin/')],
  ['apps/mobile/app', () => true],
  ['apps/mobile/src', () => true],
  ['packages/shared/src/labels.ts', () => true],
  ['packages/shared/src/privacy', () => true],
];
const ATTRS = new Set(['placeholder', 'title', 'label', 'subtitle', 'hint', 'text', 'description', 'aria-label', 'alt', 'sub', 'caption', 'message', 'confirmLabel', 'emptyText', 'loadingText', 'ctaLabel']);
const PROPS = new Set(['label', 'title', 'text', 'subtitle', 'description', 'placeholder', 'hint', 'sub', 'desc', 'what', 'why', 'who', 'security', 'optional', 'allow', 'notNow', 'intro', 'l', 'name', 'summary', 'tagline', 'cta', 'empty', 'success', 'caption', 'message']);
const CALLS = new Set(['success', 'error', 'info', 'warning', 'confirm', 'alert', 'showToast', 'setError', 'Error']);

const out = new Map(); // key -> Set(files)
const letters = /[A-Za-zऀ-ॿ]/;
const isTechnical = (s) =>
  !letters.test(s) ||
  /^[A-Z0-9_]+$/.test(s) || // enum values
  /^(https?:|\/|#|\.|@|mailto:|tel:)/.test(s) ||
  /^[a-z][a-zA-Z0-9]*$/.test(s) && !/\s/.test(s) && s.length < 25 && !/[ऀ-ॿ]/.test(s) && s === s.toLowerCase() && !['rent', 'buy', 'save', 'saved', 'login', 'logout', 'done', 'retry', 'reset', 'share', 'call', 'chat', 'more', 'home', 'search', 'profile', 'leads', 'inbox', 'inventory', 'visits', 'deals', 'team', 'analytics', 'feedback', 'notifications', 'draft', 'live', 'rejected', 'negotiable', 'verified', 'owner', 'map', 'list', 'grid', 'filters', 'alert', 'next', 'back', 'close', 'cancel', 'submit', 'send', 'edit', 'delete', 'remove', 'upload', 'camera', 'gallery', 'skip'].includes(s) ||
  /^[\w-]+\.(png|jpg|svg|json|tsx?)$/.test(s) ||
  /^[a-z-]+(\s[a-z-]+)*$/.test(s) && /(^|\s)(flex|grid|text-|bg-|px-|py-|rounded|border|font-|size-|gap-|w-|h-|mt-|mb-|items-|justify-)/.test(s);
const norm = (s) => s.replace(/\s+/g, ' ').trim();
function add(s, file) {
  const k = norm(s);
  if (!k || k.length < 2 || k.length > 400 || isTechnical(k)) return;
  if (!out.has(k)) out.set(k, new Set());
  out.get(k).add(file);
}
function tpl(node) {
  // `${a} listings` → "{n} listings"
  let s = node.head.text;
  for (const span of node.templateSpans) s += '{n}' + span.literal.text;
  return s;
}
function strOf(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return tpl(node);
  return null;
}
function collectExpr(node, file) {
  // strings inside JSX expressions: {'x'}, {a ? 'x' : 'y'}, {a && 'x'}, {`${n} x`}
  const s = strOf(node);
  if (s != null) return add(s, file);
  if (ts.isConditionalExpression(node)) return collectExpr(node.whenTrue, file), collectExpr(node.whenFalse, file);
  if (ts.isBinaryExpression(node)) return collectExpr(node.left, file), collectExpr(node.right, file);
  if (ts.isParenthesizedExpression(node)) return collectExpr(node.expression, file);
}
function walk(file) {
  const src = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    if (ts.isJsxText(n)) add(n.text, file);
    else if (ts.isJsxExpression(n) && n.expression && (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))) collectExpr(n.expression, file);
    else if (ts.isJsxAttribute(n) && ATTRS.has(n.name.getText()) && n.initializer) {
      const init = n.initializer;
      if (ts.isStringLiteral(init)) add(init.text, file);
      else if (ts.isJsxExpression(init) && init.expression) collectExpr(init.expression, file);
    } else if (ts.isPropertyAssignment(n) && PROPS.has(n.name.getText?.() ?? '')) collectExpr(n.initializer, file);
    else if (ts.isCallExpression(n)) {
      const name = ts.isPropertyAccessExpression(n.expression) ? n.expression.name.text : ts.isIdentifier(n.expression) ? n.expression.text : '';
      if (CALLS.has(name) || name === 'plural') n.arguments.forEach((a) => collectExpr(a, file));
    } else if (ts.isNewExpression(n) && /Exception|Error/.test(n.expression.getText())) n.arguments?.forEach((a) => collectExpr(a, file));
    else if (ts.isArrayLiteralExpression(n) && n.elements.length >= 2 && n.elements.every((e) => ts.isStringLiteral(e))) {
      // tuples like ['RENT', 'Rent out', 'किराये पर देनी है'] — keep human-looking members
      n.elements.forEach((e) => /\s|[ऀ-ॿ]/.test(e.text) && add(e.text, file));
    }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
function files(p, keep) {
  const st = fs.statSync(p);
  if (st.isFile()) return /\.(tsx?|mjs)$/.test(p) && keep(p) ? [p] : [];
  return fs.readdirSync(p).flatMap((f) => (f === 'node_modules' || f.startsWith('.') ? [] : files(path.join(p, f), keep)));
}
for (const [root, keep] of ROOTS) for (const f of files(root, keep)) walk(f);
// shared label maps (values)
const catalog = Object.fromEntries([...out.keys()].sort().map((k) => [k, '']));
fs.writeFileSync('scripts/i18n/catalog.json', JSON.stringify(catalog, null, 1));
const hindi = [...out.keys()].filter((k) => /[ऀ-ॿ]/.test(k)).length;
console.log(`catalog: ${out.size} strings (${hindi} with Devanagari)`);

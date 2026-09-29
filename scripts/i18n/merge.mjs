// Merges translation batches (lines of "<index>\t<translation>", index into the catalog's key order)
// into packages/shared/src/i18n/locales/<lang>.json and flags lines that look misaligned.
// Usage: node scripts/i18n/merge.mjs <batch-dir>   (files named <lang>.<chunk>.txt)
// Indexes refer to scripts/i18n/batch-keys.json (the catalog frozen when the batches were written).
// Strings added later (CMS/seed copy, new UI text) go in <batch-dir>/extra/<lang>.json as { source: translation }.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const baseKeys = JSON.parse(fs.readFileSync('scripts/i18n/batch-keys.json', 'utf8'));
const extraKeys = JSON.parse(fs.readFileSync('scripts/i18n/extra-keys.json', 'utf8'));
const LOC = 'packages/shared/src/i18n/locales';
const count = (s, re) => (s.match(re) ?? []).length;
const KEEP = /\b(BrokerIQ|WhatsApp|RERA|KYC|BHK|OTP|CRM|GST|EMI|AI|PG|RK|UPI|Razorpay|Google|Facebook|Housing|99acres|MagicBricks|IMAP|SMTP|API|CSV|PDF|QR)\b/g;
const byLang = {};
for (const f of fs.readdirSync(dir).filter((f) => /^[a-z]{2}\.(\d+|x)\.txt$/.test(f)).sort()) {
  const lang = f.split('.')[0];
  const keys = f.includes('.x.') ? extraKeys : baseKeys; // <lang>.x.txt indexes extra-keys.json
  const dict = (byLang[lang] ??= {});
  for (const line of fs.readFileSync(path.join(dir, f), 'utf8').split('\n')) {
    if (!line.trim()) continue;
    const tab = line.indexOf('\t');
    const i = Number(line.slice(0, tab));
    const val = line.slice(tab + 1).trim();
    const key = keys[i];
    if (tab < 0 || !key || !val) {
      console.warn(`${f}: bad line "${line.slice(0, 60)}"`);
      continue;
    }
    const warn = [];
    const slots = count(key, /\{n\}/g);
    const idx = [...val.matchAll(/\{(\d)\}/g)].map((m) => Number(m[1]));
    if (idx.length ? idx.length !== slots || idx.some((i) => i < 1 || i > slots) || count(val, /\{n\}/g) : slots !== count(val, /\{n\}/g)) warn.push('{n} count');
    const keyDigits = (key.match(/\d+/g) ?? []).join(',');
    const valDigits = (val.match(/\d+/g) ?? []).join(',');
    if (keyDigits && keyDigits.split(',').some((d) => !val.includes(d))) warn.push(`digits ${keyDigits}→${valDigits}`);
    for (const k of new Set(key.match(KEEP) ?? [])) if (!val.includes(k) && !['AI', 'PG'].includes(k)) warn.push(`lost ${k}`);
    if (warn.length) console.warn(`${f} #${i}: ${warn.join('; ')}\n   ${key}\n   ${val}`);
    if (val !== key) dict[key] = val;
  }
}
const extraDir = path.join(dir, 'extra');
if (fs.existsSync(extraDir))
  for (const f of fs.readdirSync(extraDir).filter((f) => f.endsWith('.json'))) {
    const lang = f.replace('.json', '');
    Object.assign((byLang[lang] ??= {}), JSON.parse(fs.readFileSync(path.join(extraDir, f), 'utf8')));
  }
for (const [lang, dict] of Object.entries(byLang)) {
  const file = path.join(LOC, `${lang}.json`);
  const sorted = Object.fromEntries(Object.entries(dict).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
  console.log(`${lang}: ${Object.keys(sorted).length} entries`);
}

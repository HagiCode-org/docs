#!/usr/bin/env node
// Read-only discovery adapter for the doc-translation skill (contract: references/profile-spec.md).
//   node translations/discover.mjs --locale en-US            NDJSON, one line per baseline doc
//   node translations/discover.mjs --locale en-US --pending  only docs that still need work (backlog counting)
//
// Source = the zh-CN baseline in src/content/docs (blog/ and img/ excluded). Target = one of the nine other locales.
// `external` is true when the site already carries a translation of the doc that is not older than the baseline
// ("not older" = the baseline's last touch is not later than the translation's; see makeTouchClock) and the skill
// did not write it itself. Missing and older translations are `external: false`, i.e. work for the skill.
import fs from 'node:fs';
import path from 'node:path';
import {
  LOCALES, REPO, SOURCE_ROOT, listSourceDocs, makeTouchClock, sha256, siteTranslationPath, sourceRevision,
} from './lib.mjs';

const args = process.argv.slice(2);
const locale = args[args.indexOf('--locale') + 1];
const pendingOnly = args.includes('--pending');
if (!LOCALES.includes(locale)) {
  console.error(`usage: discover.mjs --locale <${LOCALES.join('|')}> [--pending]`);
  process.exit(2);
}

function readSnapshotDocs() {
  try {
    const snap = JSON.parse(fs.readFileSync(path.join(REPO, 'translations/locales', locale, 'state/snapshot.json'), 'utf8'));
    return snap.docs ?? {};
  } catch {
    return {};
  }
}

const docs = listSourceDocs();
if (docs.length === 0) {
  console.error('no baseline docs found: refusing to print an empty list');
  process.exit(1);
}
const touched = makeTouchClock();
const own = readSnapshotDocs();
const lines = [{ _meta: { sourceRevision: sourceRevision() } }];
for (const doc of docs) {
  const buf = fs.readFileSync(path.join(REPO, SOURCE_ROOT, doc));
  const sha = sha256(buf);
  const siteRel = siteTranslationPath(locale, doc);
  let external = false;
  if (fs.existsSync(path.join(REPO, siteRel))) {
    external = touched(`${SOURCE_ROOT}/${doc}`) <= touched(siteRel);
  }
  const mine = own[doc];
  const ours = mine && (mine.status === 'done' || mine.status === 'done_flagged');
  if (ours) external = false; // the skill's own translation: let the skill classify it (done / stale)
  if (pendingOnly) {
    if (external || (ours && mine.sourceSha256 === sha)) continue;
  }
  lines.push({ doc, bytes: buf.length, sha256: sha, external });
}
process.stdout.write(lines.map((l) => JSON.stringify(l)).join('\n') + '\n');

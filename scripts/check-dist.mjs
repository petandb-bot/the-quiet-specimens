import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';

// GitHub Pages publishes the built directory under a repository subpath,
// not the Vite development source. Check each emitted entry and its assets.
const root = resolve('dist');
for (const entry of ['index.html', 'legacy/index.html', 'tests/browser-check.html']) {
  const html = await readFile(resolve(root, entry), 'utf8');
  assert(!/\b(?:src|href)\s*=\s*["'](?:\/|\.\.?\/)*src\//i.test(html), entry + ': development source reference');
  const tags = html.match(/<(?:script|link)\b[^>]*>/gi) ?? [];
  let modules = 0;
  for (const tag of tags) {
    const ref = tag.match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1];
    if (!ref || /^(?:data:|https?:|#)/i.test(ref)) continue;
    assert(!ref.startsWith('/'), entry + ': root-relative asset ' + ref);
    const path = resolve(root, dirname(entry), ref.split(/[?#]/)[0]);
    assert(!relative(root, path).startsWith('..'), entry + ': asset outside dist');
    assert((await stat(path)).isFile(), entry + ': missing asset ' + ref);
    if (/<script\b/i.test(tag) && /\btype=["']module["']/i.test(tag)) {
      assert(/\.m?js(?:[?#]|$)/i.test(ref), entry + ': uncompiled module ' + ref);
      modules++;
    }
  }
  assert(modules > 0, entry + ': missing compiled module');
  console.log('Verified published entry:', entry);
}

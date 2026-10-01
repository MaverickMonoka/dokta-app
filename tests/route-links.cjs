const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}
const pages = new Set(walk('app').filter((p) => p.endsWith('/page.tsx')).map((p) => {
  const route = '/' + path.relative('app', path.dirname(p)).replaceAll(path.sep, '/');
  return route === '/.' ? '/' : route;
}));
function routeExists(href) {
  const pathname = href.split(/[?#]/)[0] || '/';
  if (pages.has(pathname)) return true;
  return [...pages].some((route) => {
    const pattern = '^' + route.replace(/\[([^/]+)\]/g, '[^/]+') + '$';
    return new RegExp(pattern).test(pathname);
  });
}
const files = walk('app').concat(walk('components')).filter((p) => /\.(tsx|ts)$/.test(p));
const links = [];
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(/(?:href|pathname)\s*=\s*(?:\{\s*)?["'`]([^"'`]+)["'`]/g)) {
    if (match[1].startsWith('/')) links.push([file, match[1]]);
  }
}
const missing = links.filter(([, href]) => !routeExists(href));
assert.deepEqual(missing, [], 'Broken internal links: ' + JSON.stringify(missing));
for (const required of ['/login','/signup','/legal/privacy','/account/password','/patient/appointments','/doctor','/pharmacy/pos','/clinic/queue','/admin/doctors']) {
  assert.ok(routeExists(required), 'Missing required route: ' + required);
}
console.log('Internal route audit passed:', links.length, 'links checked across', pages.size, 'pages');

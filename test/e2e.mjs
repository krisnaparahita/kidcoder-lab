/* KidCoder Lab - browser end-to-end check (npm run test:e2e).
 * Serves the deployable files with the same headers as vercel.json
 * (including the CSP), drives headless Chrome over the DevTools
 * protocol and fails on any page error, console error or CSP violation.
 * Requires Node 22+ (global WebSocket) and Chrome/Chromium.
 * Set CHROME_PATH to override browser detection. */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = ['index.html', 'css/', 'js/', 'assets/'];
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium', '/usr/bin/chromium-browser'
  ];
  const hit = candidates.find((p) => p && existsSync(p));
  if (!hit) throw new Error('Chrome not found; set CHROME_PATH');
  return hit;
}

/* --------------------- static server with vercel.json headers ---------------- */

const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
function headersFor(path) {
  const out = {};
  for (const rule of vercel.headers || []) {
    const re = new RegExp('^' + rule.source.replace(/\(\.\*\)/g, '.*') + '$');
    if (re.test(path)) for (const h of rule.headers) out[h.key] = h.value;
  }
  return out;
}

const server = createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const rel = path === '/' ? 'index.html' : normalize(path.slice(1));
  const file = join(ROOT, rel);
  const allowed = PUBLIC.some((p) => rel === p || (p.endsWith('/') && rel.startsWith(p)));
  if (!allowed || rel.includes('..') || !existsSync(file)) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', ...headersFor(path) });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const BASE = 'http://127.0.0.1:' + server.address().port + '/';

/* ------------------------------- chrome + CDP -------------------------------- */

const profileDir = mkdtempSync(join(tmpdir(), 'kidcoder-e2e-'));
const chrome = spawn(findChrome(), [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--no-sandbox', '--remote-debugging-port=0', '--user-data-dir=' + profileDir, 'about:blank'
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((resolve, reject) => {
  let buf = '';
  const t = setTimeout(() => reject(new Error('Chrome did not start')), 20000);
  chrome.stderr.on('data', (d) => {
    buf += d;
    const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf);
    if (m) { clearTimeout(t); resolve(m[1]); }
  });
});
const port = new URL(wsUrl).port;
let targets = [];
for (let i = 0; i < 40 && !targets.some((t) => t.type === 'page'); i++) {
  targets = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
  await sleep(100);
}
const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });

let seq = 0;
const pending = {};
const problems = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; }
  if (d.method === 'Runtime.exceptionThrown') {
    const e = d.params.exceptionDetails;
    problems.push('exception: ' + ((e.exception && e.exception.description) || e.text));
  }
  if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning')) {
    problems.push('console.' + d.params.type + ': ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
  }
  if (d.method === 'Log.entryAdded' && d.params.entry.level === 'error') problems.push('log: ' + d.params.entry.text);
};
const send = (method, params = {}) => new Promise((r) => { const id = ++seq; pending[id] = r; ws.send(JSON.stringify({ id, method, params })); });
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.result.exceptionDetails) throw new Error(expr.slice(0, 60) + ' -> ' + (r.result.exceptionDetails.exception || {}).description);
  return r.result.result.value;
}

let failed = false;
function check(name, ok, info) {
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (info !== undefined ? ' (' + info + ')' : ''));
  if (!ok) failed = true;
}

try {
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');

  await send('Page.navigate', { url: BASE });
  await sleep(1500);
  check('profile picker renders', (await evaluate(`(document.querySelector('h1')||{}).textContent`)) === 'KidCoder Lab');

  await evaluate(`(function(){var p=App.store.createProfile({name:'E2E',avatar:App.store.AVATARS[0],age:9});App.store.setActiveId(p.id);})()`);
  await send('Page.reload');
  await sleep(1500);
  check('active profile restored after reload', await evaluate(`!!App.Progress.profile() && App.Progress.profile().name === 'E2E'`));

  const cats = await evaluate(`App.Curriculum.CATEGORIES.map(function(c){return '#/category/'+c.id})`);
  for (const route of ['#/map', '#/dashboard', '#/gallery', '#/settings', '#/profiles', ...cats]) {
    await evaluate(`App.go('${route}')`);
    await sleep(250);
    check('route ' + route, (await evaluate(`document.querySelector('.screen').children.length`)) > 0);
  }

  const first = await evaluate(`App.Curriculum.LEVELS[0].id`);
  await evaluate(`App.go('#/level/${first}')`);
  await sleep(400);
  await evaluate(`Array.prototype.find.call(document.querySelectorAll('button'),function(b){return /Start practice/.test(b.textContent)}).click()`);
  await sleep(500);
  check('practice round starts', await evaluate(`!!document.querySelector('.ex-prompt') && App.Runner.state.set.items.length > 0`));

  const locked = await evaluate(`App.Curriculum.LEVELS[App.Curriculum.LEVELS.length-1].id`);
  await evaluate(`App.go('#/level/${locked}')`);
  await sleep(400);
  check('locked level cannot be deep-linked', !(await evaluate(`/Start practice/.test(document.body.textContent)`)));

  const r = await evaluate(`(function(){var n=0,fail=[];App.Curriculum.LEVELS.forEach(function(l){
    for (var s=0;s<3;s++) App.Exercises.buildSet(l,'e2e'+s).items.forEach(function(ex){
      try {
        var api={submit:function(){return Promise.resolve({correct:true})},next:function(){},level:l};
        var out=(App.Renderers[ex.type]||App.Renderers.logic).render(ex,api);
        if(!out||!out.node) throw new Error('no node');
        document.body.appendChild(out.node); out.node.remove(); n++;
      } catch(e){ fail.push(l.id+'/'+ex.variant+': '+e.message); }
    }); });
    return {n:n, fail:fail};})()`);
  check('every exercise renders', r.fail.length === 0 && r.n > 0, r.n + ' rendered' + (r.fail.length ? '; ' + r.fail.slice(0, 5).join('; ') : ''));

  await sleep(300);
  check('no page errors, console errors or CSP violations', problems.length === 0, problems.slice(0, 10).join(' | ') || 'none');
} catch (e) {
  check('e2e run', false, e.message);
} finally {
  ws.close();
  chrome.kill();
  server.close();
  await sleep(300);
  try { rmSync(profileDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
}

process.exit(failed ? 1 : 0);

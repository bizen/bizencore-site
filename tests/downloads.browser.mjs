import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const root = process.cwd();
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    const filename = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
    const file = path.resolve(root, `.${filename}`);
    if (!file.startsWith(`${root}/`)) { response.writeHead(403).end(); return; }
    const body = await readFile(file);
    const ext = path.extname(file);
    response.writeHead(200, { 'Content-Type': ({ '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' })[ext] ?? 'application/octet-stream' }).end(body);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ headless: true, ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}) });
const base = `http://127.0.0.1:${server.address().port}`;
try {
  const page = await browser.newPage();
  const missing = [];
  page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) missing.push(response.url()); });
  await page.route('**/downloads/desktop/latest.json', route => route.fulfill({ json: { published: false } }));
  await page.goto(`${base}/downloads/`);
  await page.waitForFunction(() => document.querySelector('figure img').complete && document.querySelector('figure img').naturalWidth > 0);
  const limitations = await page.locator('#limitations').innerText();
  assert.ok(limitations.includes('失効後・再ログイン後とも拒否'));
  assert.ok(limitations.includes('認証失効までの正確な時間測定は未実施'));
  assert.equal(await page.locator('#download').getAttribute('aria-disabled'), 'true');
  assert.equal(await page.locator('#download').getAttribute('href'), null);
  await page.unroute('**/downloads/desktop/latest.json');
  const release = { version: '0.1.8', channel: 'production', platform: 'darwin', arch: 'arm64', published: true,
    adHocSigned: true, developerIdSigned: false, notarized: false, updateMethod: 'manual',
    sha256: 'a'.repeat(64), sourceCommit: 'b'.repeat(40), size: 145_000_000,
    downloadUrl: 'https://github.com/bizen/bizencore-os/releases/download/desktop-v0.1.8/bizencore-terminal-0.1.8-darwin-arm64.zip',
    checksumUrl: 'https://github.com/bizen/bizencore-os/releases/download/desktop-v0.1.8/SHA256SUMS',
    notesUrl: 'https://github.com/bizen/bizencore-os/releases/tag/desktop-v0.1.8' };
  let manifest = release;
  await page.route('**/downloads/desktop/latest.json', route => route.fulfill({ json: manifest }));
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#download').getAttribute('aria-disabled') === 'false');
  assert.equal(await page.locator('#download').getAttribute('href'), release.downloadUrl);
  assert.ok((await page.locator('#checksum').innerText()).includes(release.sha256));
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('figure img').evaluate(image => image.naturalWidth > 0));
    await page.screenshot({ path: `/private/tmp/bizencore-download-page-${width}.png` });
  }
  for (const patch of [{ published: false }, { arch: 'x64' }, { sha256: 'bad' }, { downloadUrl: 'https://attacker.test/app.zip' }, { sourceCommit: '' }]) {
    manifest = { ...release, ...patch };
    await page.reload();
    await page.waitForLoadState('networkidle');
    assert.equal(await page.locator('#download').getAttribute('aria-disabled'), 'true');
    assert.equal(await page.locator('#download').getAttribute('href'), null);
  }
  await page.unroute('**/downloads/desktop/latest.json');
  const actual = JSON.parse(await readFile(path.join(root, 'downloads/desktop/latest.json'), 'utf8'));
  if (actual.published === true) {
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#download').getAttribute('aria-disabled') === 'false');
    assert.equal(await page.locator('#download').getAttribute('href'), actual.downloadUrl);
    assert.ok((await page.locator('#release-status').innerText()).includes(actual.version));
    assert.ok((await page.locator('#checksum').innerText()).includes(actual.sha256));
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: '/private/tmp/bizencore-beta-download-page-1440.png' });
  }
  await page.route('**/downloads/desktop/latest.json', route => route.fulfill({ status: 404 }));
  await page.reload();
  assert.equal(await page.locator('#download').getAttribute('aria-disabled'), 'true');
  assert.deepEqual(missing.filter(url => !url.endsWith('latest.json')), []);
  console.log('Download page: unpublished/invalid feeds fail closed; published metadata, assets and 1440/390/320 layouts verified.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }

const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8788';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hoayeuuyen';
const RUN_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const SHOT_DIR = path.resolve(process.cwd(), 'tmp-playwright', 'screenshots', `admin-flow-${RUN_ID}`);

fs.mkdirSync(SHOT_DIR, { recursive: true });

// 1x1 transparent PNG
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO6pBtsAAAAASUVORK5CYII=',
  'base64'
);

test.use({ viewport: { width: 390, height: 844 } });
test.setTimeout(240000);

test('admin one-tap publish flow with screenshots + backtest', async ({ page, request }) => {
  const stamp = Date.now();
  const title = `🥺🥺🥺 one-tap test ${stamp}`;
  const body = `Đây là nội dung test one-tap tại ${new Date().toISOString()}.`;

  const shot = async (name) => {
    const file = path.join(SHOT_DIR, name);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  };

  const report = {
    baseUrl: BASE_URL,
    title,
    screenshotDir: SHOT_DIR,
    screenshots: [],
    checks: {},
  };

  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
  report.screenshots.push(await shot('01-admin-locked.png'));

  await page.fill('[data-admin-password]', ADMIN_PASSWORD);
  await page.click('[data-admin-login]');
  await expect(page.locator('[data-auth-unlocked]')).toBeVisible({ timeout: 15000 });
  report.screenshots.push(await shot('02-admin-unlocked.png'));

  await page.click('[data-new-post]');
  await page.fill("[name='title']", title);
  await page.fill("[name='content_md']", body);
  report.screenshots.push(await shot('03-filled-form.png'));

  await page.setInputFiles('[data-upload-input]', {
    name: `one-tap-${stamp}.png`,
    mimeType: 'image/png',
    buffer: TINY_PNG,
  });
  await expect(page.locator('[data-upload-note]')).toContainText('Đã upload', { timeout: 90000 });
  report.screenshots.push(await shot('04-image-uploaded.png'));

  await page.click('[data-submit-post]');
  await expect(page.locator('[data-form-note]')).toContainText('Đã đăng bài.', { timeout: 120000 });
  await expect(page.locator('[data-link-preview]')).toBeVisible({ timeout: 15000 });
  report.screenshots.push(await shot('05-published-in-admin.png'));

  const entryLink = await page.locator('[data-link-text]').inputValue();
  report.entryLink = entryLink;

  await page.goto(entryLink, { waitUntil: 'networkidle' });
  await expect(page.locator('h1')).toContainText('one-tap test', { timeout: 15000 });
  report.screenshots.push(await shot('06-public-entry.png'));

  const slug = new URL(entryLink).pathname.split('/').filter(Boolean).pop() || '';
  report.slug = slug;

  const postRes = await request.get(`${BASE_URL}/api/posts/${slug}`);
  const postBody = await postRes.json().catch(() => ({}));
  report.checks.apiPostBySlug = {
    status: postRes.status(),
    ok: postRes.ok(),
    hasPost: Boolean(postBody?.post),
  };

  const healthRes = await request.get(`${BASE_URL}/api/health`);
  const healthBody = await healthRes.json().catch(() => ({}));
  report.checks.apiHealth = {
    status: healthRes.status(),
    ok: healthRes.ok(),
    schemaPosts: Boolean(healthBody?.schema?.posts),
    schemaPostMedia: Boolean(healthBody?.schema?.postMedia),
  };

  const reportPath = path.join(SHOT_DIR, 'backtest-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  expect(report.checks.apiPostBySlug.ok).toBeTruthy();
  expect(report.checks.apiPostBySlug.hasPost).toBeTruthy();
  expect(report.checks.apiHealth.ok).toBeTruthy();
  expect(report.checks.apiHealth.schemaPosts).toBeTruthy();
});

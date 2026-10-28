const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', error => errors.push(error.message));

  await page.goto('http://127.0.0.1:4173/login.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);
  const loginTitle = await page.locator('h1').first().textContent();

  await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForURL(/login\.html/, { timeout: 30000 });
  const redirectedToLogin = page.url().includes('login.html');

  console.log(JSON.stringify({ loginTitle, redirectedToLogin, consoleErrors: errors }, null, 2));
  await browser.close();
  if (!redirectedToLogin) process.exit(1);
})();

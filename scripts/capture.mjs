import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const BASE_URL = process.env.EBAG_BASE_URL || 'https://ebag.bg';
const LOGIN_URL = process.env.EBAG_LOGIN_URL || `${BASE_URL}/login`;
const OUTPUT_DIR = process.env.EBAG_CAPTURE_DIR || path.join(process.cwd(), 'captures');
const MAX_BODY_BYTES = Number(process.env.EBAG_MAX_BODY_BYTES || 20000);
const CAPTURE_ALL = process.env.EBAG_CAPTURE_ALL === '1';

const EMAIL = process.env.EBAG_EMAIL;
const PASSWORD = process.env.EBAG_PASSWORD;
const EMAIL_SELECTOR = process.env.EBAG_EMAIL_SELECTOR;
const PASSWORD_SELECTOR = process.env.EBAG_PASSWORD_SELECTOR;
const SUBMIT_SELECTOR = process.env.EBAG_SUBMIT_SELECTOR;

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (answer) => {
    rl.close();
    resolve(answer);
  }));
}

function nowStamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

function isEbagUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname.endsWith('ebag.bg');
  } catch {
    return false;
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  const captures = [];
  const markers = [];

  page.on('response', async (response) => {
    const request = response.request();
    const url = request.url();
    if (!CAPTURE_ALL && !isEbagUrl(url)) return;

    const record = {
      time: new Date().toISOString(),
      url,
      method: request.method(),
      request: {
        headers: request.headers(),
        postData: request.postData() || null,
      },
      response: {
        status: response.status(),
        headers: response.headers(),
        body: null,
        bodyTruncated: false,
      },
    };

    const contentType = response.headers()['content-type'] || '';
    const isText = contentType.includes('application/json') || contentType.startsWith('text/');

    if (isText) {
      try {
        const body = await response.body();
        if (body.length > MAX_BODY_BYTES) {
          record.response.body = body.subarray(0, MAX_BODY_BYTES).toString('utf8');
          record.response.bodyTruncated = true;
        } else {
          record.response.body = body.toString('utf8');
        }
      } catch {
        record.response.body = null;
      }
    }

    captures.push(record);
  });

  console.log(`Opening ${BASE_URL}...`);
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });

  console.log('Navigating to login page...');
  await page.goto(LOGIN_URL, { waitUntil: 'domcontentloaded' });

  if (EMAIL && PASSWORD && EMAIL_SELECTOR && PASSWORD_SELECTOR && SUBMIT_SELECTOR) {
    console.log('Attempting automated login...');
    await page.fill(EMAIL_SELECTOR, EMAIL);
    await page.fill(PASSWORD_SELECTOR, PASSWORD);
    await page.click(SUBMIT_SELECTOR);
    await page.waitForLoadState('networkidle');
  } else {
    console.log('Auto-login not configured. Please log in manually in the opened browser.');
    await prompt('Press Enter after login is complete...');
  }

  markers.push({ label: 'login-complete', time: new Date().toISOString() });

  console.log('Now perform the actions in the browser to capture network calls.');
  console.log('Suggested order: search, add-to-cart, add-to-list.');

  await prompt('After completing SEARCH, press Enter...');
  markers.push({ label: 'search-complete', time: new Date().toISOString() });

  await prompt('After completing ADD-TO-CART, press Enter...');
  markers.push({ label: 'add-to-cart-complete', time: new Date().toISOString() });

  await prompt('After completing ADD-TO-LIST, press Enter...');
  markers.push({ label: 'add-to-list-complete', time: new Date().toISOString() });

  const outputPath = path.join(OUTPUT_DIR, `capture-${nowStamp()}.json`);
  fs.writeFileSync(outputPath, JSON.stringify({ markers, captures }, null, 2), 'utf8');

  console.log(`Capture saved to ${outputPath}`);
  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

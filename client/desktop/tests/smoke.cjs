const { _electron: electron } = require('@playwright/test');
const assert = require('node:assert/strict');
const path = require('node:path');

(async () => {
  const application = await electron.launch({ args: [path.resolve(__dirname, '..')] });
  try {
    const page = await application.firstWindow();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.waitForSelector('input[type="email"]');
    const result = await page.evaluate(() => ({
      origin: location.origin,
      secure: isSecureContext,
      platform: window.huddleDesktop?.platform,
      node: typeof window.require,
      legacyBridge: typeof window.electronAPI,
      content: document.querySelector('#root').textContent.length,
    }));
    assert.equal(result.origin, 'huddle://app');
    assert.equal(result.secure, true);
    assert.equal(result.platform, process.platform);
    assert.equal(result.node, 'undefined');
    assert.equal(result.legacyBridge, 'undefined');
    assert.ok(result.content > 100);
    const sandboxed = await application.evaluate(({ BrowserWindow }) => {
      const settings = BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences();
      return settings.sandbox && settings.contextIsolation && !settings.nodeIntegration;
    });
    assert.equal(sandboxed, true);
    const blocked = await page.evaluate(async () => {
      const response = await fetch('huddle://other/index.html');
      return response.status;
    }).catch(() => 403);
    assert.equal(blocked, 403);
    assert.deepEqual(errors, []);
    console.log('Electron smoke passed: bundled renderer, secure origin, preload and sandbox.');
  } finally {
    await application.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

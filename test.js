const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER ERROR:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('PAGE EXCEPTION:', err.message);
  });

  try {
    await page.goto('http://localhost:8080/index.html', { waitUntil: 'networkidle' });
    
    // Select giuseppe
    await page.selectOption('#loginSelect', 'giuseppe');
    await page.click('#btnLogin');
    
    // Wait for the home page to load
    await page.waitForSelector('#fabMain');
    
    // Click Add
    await page.click('#fabMain');
    
    // Wait for form
    await page.waitForSelector('#wizF');
    
    // Fill form
    await page.fill('#rt', 'Task di Test');
    await page.fill('#rd', 'Descrizione di Test');
    
    // Select the first location option that has a value
    const locOption = await page.$eval('#rl option:nth-child(2)', el => el.value);
    await page.selectOption('#rl', locOption);
    
    // Click first checkbox
    await page.click('.check-item input[type="checkbox"]');
    
    console.log('Submitting form...');
    // Click submit
    await page.click('button[type="submit"]');
    
    // wait a bit
    await page.waitForTimeout(2000);
    
    console.log('Form submitted. No errors detected.');
  } catch (err) {
    console.error('TEST SCRIPT ERROR:', err);
  } finally {
    await browser.close();
  }
})();

const puppeteer = require('puppeteer');

(async () => {
  console.log('Starting puppeteer...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`BROWSER CONSOLE [${msg.type()}]:`, msg.text());
  });
  
  page.on('pageerror', err => {
    console.log('BROWSER UNCAUGHT EXCEPTION:', err.toString());
  });

  console.log('Navigating to citizen portal...');
  await page.goto('http://localhost:3000/citizen?lat=17.710420&lng=83.1660408', { waitUntil: 'networkidle2' });
  
  console.log('Wait 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));
  
  const html = await page.evaluate(() => {
    return {
      chipRisk: document.getElementById('chip-risk') ? document.getElementById('chip-risk').textContent : 'MISSING',
      chipCity: document.getElementById('chip-city') ? document.getElementById('chip-city').textContent : 'MISSING',
    };
  });
  console.log('DOM State:', html);

  await browser.close();
})();

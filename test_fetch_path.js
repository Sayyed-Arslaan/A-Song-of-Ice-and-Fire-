const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set up console logging
  page.on('console', msg => {
      console.log(`[Browser Console]: ${msg.text()}`);
  });

  await page.route('**/*', route => {
      route.continue();
  });

  await page.goto('https://google.com'); // blank slate

  await page.setContent(`
    <script>
      async function test() {
        try {
          const res = await fetch('images.json');
          console.log('fetch successful', res.status);
        } catch (e) {
          console.log('fetch failed', e.message);
        }
      }
      test();
    </script>
  `);

  await new Promise(r => setTimeout(r, 1000));
  await browser.close();
})();

const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set up console logging
  page.on('console', msg => {
      console.log(`[Browser Console]: ${msg.text()}`);
  });

  // Intercept all requests
  await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/A-Song-of-Ice-and-Fire-')) {
          const newPath = url.pathname.replace('/A-Song-of-Ice-and-Fire-', '');
          const newUrl = `http://localhost:8000${newPath === '' ? '/' : newPath}`;
          console.log(`Rewriting ${url.pathname} -> ${newUrl}`);
          route.continue({ url: newUrl });
      } else {
          route.continue();
      }
  });

  // Inject a script right after page load to log fetch calls
  await page.addInitScript(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        console.log(`Fetching: ${args[0]}`);
        return originalFetch(...args);
    };
  });

  console.log('Navigating to http://localhost:8000/A-Song-of-Ice-and-Fire-/index.html');
  await page.goto('http://localhost:8000/A-Song-of-Ice-and-Fire-/index.html', { waitUntil: 'networkidle' });

  await page.screenshot({ path: 'gh_pages_sim_after_fix.png' });
  await browser.close();
})();

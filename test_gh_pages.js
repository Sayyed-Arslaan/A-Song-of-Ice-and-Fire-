const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  // mock the fact that it's on a subpath, e.g. /A-Song-of-Ice-and-Fire-
  await page.route('**/*', route => {
      const url = new URL(route.request().url());
      // console.log('req:', url.pathname);
      if (url.pathname.startsWith('/A-Song-of-Ice-and-Fire-')) {
          const newPath = url.pathname.replace('/A-Song-of-Ice-and-Fire-', '');
          const newUrl = `http://localhost:8000${newPath === '' ? '/' : newPath}`;
          route.continue({ url: newUrl });
      } else {
          route.continue();
      }
  });

  await page.goto('http://localhost:8000/A-Song-of-Ice-and-Fire-/index.html', { waitUntil: 'networkidle' });
  await page.screenshot({ path: 'gh_pages_sim.png' });
  await browser.close();
})();

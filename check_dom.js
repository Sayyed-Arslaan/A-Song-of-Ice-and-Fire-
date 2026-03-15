const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));

  await page.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.pathname.startsWith('/A-Song-of-Ice-and-Fire-')) {
          const newPath = url.pathname.replace('/A-Song-of-Ice-and-Fire-', '');
          const newUrl = `http://localhost:8000${newPath === '' ? '/' : newPath}`;
          route.continue({ url: newUrl });
      } else {
          route.continue();
      }
  });

  await page.goto('http://localhost:8000/A-Song-of-Ice-and-Fire-/index.html', { waitUntil: 'networkidle' });

  const loaderVisible = await page.evaluate(() => {
    return !document.getElementById('loading').classList.contains('hidden');
  });
  console.log('Loader visible?', loaderVisible);

  const galleryItems = await page.evaluate(() => {
    return document.querySelectorAll('.gallery-item').length;
  });
  console.log('Gallery items:', galleryItems);

  await browser.close();
})();

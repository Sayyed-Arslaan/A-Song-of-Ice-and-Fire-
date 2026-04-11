document.addEventListener('DOMContentLoaded', () => {
  // State
  let allImages = [];
  let filteredImages = [];
  let currentLetter = 'ALL';
  let searchQuery = '';

  // DOM Elements
  const galleryContainer = document.getElementById('gallery');
  const loadingEl = document.getElementById('loading');
  const noResultsEl = document.getElementById('no-results');
  const searchInput = document.getElementById('search-input');
  const azList = document.getElementById('az-list');

  // Modal Elements
  const modal = document.getElementById('image-modal');
  const modalImg = document.getElementById('modal-img');
  const modalCaption = document.getElementById('modal-caption');
  const closeBtn = document.getElementById('close-modal');

  // Virtualization Config
  const itemHeight = 250;
  const itemMinWidth = 200;
  const gap = 16;
  let columns = 1;
  let containerWidth = 0;
  let renderedItems = new Map();

  // Ensure gallery container has positioning context for absolutely positioned children
  galleryContainer.style.position = galleryContainer.style.position || 'relative';

  function getContainerWidth() {
    let w = galleryContainer.clientWidth;
    if (!w || w === 0) w = galleryContainer.getBoundingClientRect().width;
    // Fallback if the container is entirely hidden or DOM isn't painted yet
    if (!w || w === 0) {
      const computedStyle = window.getComputedStyle(galleryContainer);
      const paddingLeft = parseFloat(computedStyle.paddingLeft) || 0;
      const paddingRight = parseFloat(computedStyle.paddingRight) || 0;
      w = window.innerWidth - (paddingLeft + paddingRight + 64); // rough estimate subtracting typical margins
    }
    return Math.max(w, 200); // minimum fallback width
  }

  // Intersection Observer for lazy loading images
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target;
        if (img.dataset.src) {
          img.src = img.dataset.src;
          img.onload = () => img.classList.add('loaded');
          img.removeAttribute('data-src');
          observer.unobserve(img);
        }
      }
    });
  }, { rootMargin: '200px' }); // preload a bit before entering viewport

  // Initialize
  async function init() {
    populateAZNavigation();
    setupEventListeners();
    await fetchImages();

    // try to set containerWidth immediately (covers cases where ResizeObserver doesn't fire)
    containerWidth = getContainerWidth();
    calculateGrid();
    renderVisibleItems();

    // Explicitly hide loading UI as a fallback in case it got stuck
    loadingEl.classList.add('hidden');

    // Setup a slight delay calculation to handle late-loading CSS causing reflows
    setTimeout(() => {
      containerWidth = getContainerWidth();
      calculateGrid();
      renderVisibleItems();
    }, 100);

    // Setup Resize Observer to recalculate grid layout
    const resizeObserver = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width;
      if (w > 0) {
        containerWidth = w;
        calculateGrid();
        renderVisibleItems();
      }
    });
    resizeObserver.observe(galleryContainer);

    // Setup Scroll Event
    window.addEventListener('scroll', () => {
      requestAnimationFrame(renderVisibleItems);
    }, { passive: true });

    // Also recalc on orientation change or window resize
    window.addEventListener('resize', () => {
      containerWidth = getContainerWidth();
      calculateGrid();
      renderVisibleItems();
    }, { passive: true });
  }

  function populateAZNavigation() {
    // Add ALL button first
    const liAll = document.createElement('li');
    const btnAll = document.createElement('button');
    btnAll.className = 'nav-btn active';
    btnAll.dataset.letter = 'ALL';
    btnAll.textContent = 'ALL';
    liAll.appendChild(btnAll);
    azList.appendChild(liAll);

    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.className = 'nav-btn';
      btn.dataset.letter = letter;
      btn.textContent = letter;
      li.appendChild(btn);
      azList.appendChild(li);
    }
  }

  function setupEventListeners() {
    // Search
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value.toLowerCase();
      applyFilters();
    });

    // A-Z Navigation
    azList.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON') {
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        currentLetter = e.target.dataset.letter;
        applyFilters();
      }
    });

    // Modal close
    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden-modal')) {
        closeModal();
      }
      // left / right nav in modal
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !modal.classList.contains('hidden-modal')) {
        navigateModal(e.key === 'ArrowLeft' ? -1 : 1);
      }
    });

    // Gallery Clicks (Delegation)
    galleryContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.gallery-item');
      if (item) {
        const id = item.dataset.id;
        const imageIndex = parseInt(item.dataset.index, 10);
        if (!isNaN(imageIndex) && imageIndex >= 0 && imageIndex < filteredImages.length && filteredImages[imageIndex].id === id) {
          openModal(filteredImages[imageIndex], imageIndex);
        }
      }
    });
  }



  async function fetchImages() {
    try {
      const response = await fetch('./images.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch manifest');
      const raw = await response.json();

      // normalize manifest
      allImages = normalizeManifest(raw);

      // ensure folder letters are uppercase single characters where possible
      allImages.forEach(img => {
        if (img.folder && typeof img.folder === 'string') {
          img.folder = img.folder.trim().charAt(0).toUpperCase();
        } else {
          img.folder = (img.path && img.path.split('/')[0]) ? img.path.split('/')[0].toUpperCase() : 'A';
        }
      });

      // optional: sort by folder then name for stable order
      allImages.sort((a, b) => {
        if (a.folder === b.folder) return a.name.localeCompare(b.name);
        return a.folder.localeCompare(b.folder);
      });

      loadingEl.classList.add('hidden');
      applyFilters();
    } catch (error) {
      console.error(error);
      loadingEl.textContent = 'Failed to load raven scrolls. Please try again.';
    }
  }

  function applyFilters() {
    filteredImages = allImages.filter(img => {
      const matchesLetter = currentLetter === 'ALL' || (img.folder === currentLetter);
      const q = (searchQuery || '').toLowerCase();
      const matchesSearch = !q || (img.name && img.name.toLowerCase().includes(q)) || (img.filename && img.filename.toLowerCase().includes(q));
      return matchesLetter && matchesSearch;
    });

    // Reset virtualization state
    window.scrollTo(0, 0);
    renderedItems.forEach(item => {
      item.el.remove();
      const img = item.el.querySelector('img');
      if (img) imageObserver.unobserve(img);
    });
    renderedItems.clear();

    if (filteredImages.length === 0) {
      noResultsEl.classList.remove('hidden');
      galleryContainer.style.height = '0px';
    } else {
      noResultsEl.classList.add('hidden');
      // set containerWidth fallback if not set
      containerWidth = getContainerWidth();
      calculateGrid();
      renderVisibleItems();
    }
  }

  function calculateGrid() {
    containerWidth = getContainerWidth();
    if (containerWidth === 0) return;

    columns = Math.max(1, Math.floor((containerWidth + gap) / (itemMinWidth + gap)));
    const itemWidth = (containerWidth - (gap * (columns - 1))) / columns;

    const rows = Math.ceil(filteredImages.length / columns);
    const totalHeight = rows * itemHeight + Math.max(0, rows - 1) * gap;
    galleryContainer.style.height = `${totalHeight}px`;

    // Update positions of existing rendered items
    for (const [index, item] of renderedItems.entries()) {
      const r = Math.floor(index / columns);
      const c = index % columns;
      const x = c * (itemWidth + gap);
      const y = r * (itemHeight + gap);
      item.el.style.transform = `translate(${x}px, ${y}px)`;
      item.el.style.width = `${itemWidth}px`;
    }
  }

  function getVisibleRange() {
    const scrollY = window.scrollY || window.pageYOffset;
    const windowHeight = window.innerHeight;

    // Add a buffer to render items just outside the viewport
    const bufferHeight = windowHeight;
    const galleryTop = galleryContainer.getBoundingClientRect().top + window.scrollY;
    const renderTop = Math.max(0, scrollY - galleryTop - bufferHeight);
    const renderBottom = scrollY - galleryTop + windowHeight + bufferHeight;

    const startRow = Math.max(0, Math.floor(renderTop / (itemHeight + gap)));
    const endRow = Math.min(Math.ceil(filteredImages.length / columns), Math.ceil(renderBottom / (itemHeight + gap)));

    const startIndex = startRow * columns;
    const endIndex = Math.min(filteredImages.length, endRow * columns);

    return { startIndex, endIndex };
  }

  function createGalleryItemElement(i, itemWidth) {
    const imgData = filteredImages[i];
    const r = Math.floor(i / columns);
    const c = i % columns;

    const el = document.createElement('div');
    el.className = 'gallery-item';
    el.dataset.id = imgData.id;
    el.dataset.index = i;

    const x = c * (itemWidth + gap);
    const y = r * (itemHeight + gap);

    el.style.transform = `translate(${x}px, ${y}px)`;
    el.style.width = `${itemWidth}px`;
    el.style.height = `${itemHeight}px`;
    el.style.position = 'absolute';
    el.style.top = '0';
    el.style.left = '0';
    el.style.boxSizing = 'border-box';

    // inner HTML (safe text set below)
    el.innerHTML = `
      <div class="item-image-wrapper">
        <img data-src="${imgData.thumbnail}" alt="" loading="lazy" onerror="this.onerror=null; this.closest('.item-image-wrapper').style.background='#333'">
      </div>
      <div class="item-info">
        <div class="item-title"></div>
        <div class="item-folder"></div>
      </div>
    `;

    // Set text securely
    const imgNode = el.querySelector('img');
    imgNode.alt = imgData.name || imgData.filename || '';

    const titleNode = el.querySelector('.item-title');
    titleNode.textContent = imgData.name || imgData.filename || imgData.path.split('/').pop();

    const folderNode = el.querySelector('.item-folder');
    folderNode.textContent = `Folder ${imgData.folder || ''}`;

    galleryContainer.appendChild(el);
    renderedItems.set(i, { el, index: i });

    const img = el.querySelector('img');
    imageObserver.observe(img);
  }

  function cleanupOutOfBounds(newRenderedIndices) {
    for (const [index, item] of Array.from(renderedItems.entries())) {
      if (!newRenderedIndices.has(index)) {
        const img = item.el.querySelector('img');
        if (img) imageObserver.unobserve(img);
        item.el.remove();
        renderedItems.delete(index);
      }
    }
  }

  function renderVisibleItems() {
    if (filteredImages.length === 0) return;
    if (columns === 0) { calculateGrid(); if (columns === 0) return; }

    const { startIndex, endIndex } = getVisibleRange();

    const newRenderedIndices = new Set();
    const itemWidth = (containerWidth - (gap * (columns - 1))) / columns;

    for (let i = startIndex; i < endIndex; i++) {
      newRenderedIndices.add(i);

      if (!renderedItems.has(i)) {
        createGalleryItemElement(i, itemWidth);
      }
    }

    cleanupOutOfBounds(newRenderedIndices);
  }

  let currentModalIndex = -1;
  function openModal(image, index = -1) {
    modalImg.src = image.path;
    modalCaption.textContent = image.name || image.filename || '';
    modal.classList.remove('hidden-modal');
    document.body.style.overflow = 'hidden';
    currentModalIndex = index;
  }

  function closeModal() {
    modal.classList.add('hidden-modal');
    document.body.style.overflow = 'auto';
    setTimeout(() => { modalImg.src = ''; }, 300);
    currentModalIndex = -1;
  }

  function navigateModal(direction) {
    if (currentModalIndex === -1) return;
    const newIndex = currentModalIndex + direction;
    if (newIndex < 0 || newIndex >= filteredImages.length) return;
    openModal(filteredImages[newIndex], newIndex);
  }

  // Start
  init();
});

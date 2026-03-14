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
    }, { rootMargin: '200px' }); // Preload images just before they enter viewport

    // Initialize
    async function init() {
        populateAZNavigation();
        setupEventListeners();
        await fetchImages();

        // Setup Resize Observer to recalculate grid layout
        const resizeObserver = new ResizeObserver(entries => {
            if (entries[0].contentRect.width > 0) {
                containerWidth = entries[0].contentRect.width;
                calculateGrid();
                renderVisibleItems();
            }
        });
        resizeObserver.observe(galleryContainer);

        // Setup Scroll Event
        window.addEventListener('scroll', () => {
            requestAnimationFrame(renderVisibleItems);
        }, { passive: true });
    }

    function populateAZNavigation() {
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
        });

        // Gallery Clicks (Delegation)
        galleryContainer.addEventListener('click', (e) => {
            const item = e.target.closest('.gallery-item');
            if (item) {
                const id = item.dataset.id;
                const image = allImages.find(img => img.id === id);
                if (image) openModal(image);
            }
        });
    }

    async function fetchImages() {
        try {
            const response = await fetch('images.json');
            if (!response.ok) throw new Error('Failed to fetch manifest');
            allImages = await response.json();

            loadingEl.classList.add('hidden');
            applyFilters();
        } catch (error) {
            console.error(error);
            loadingEl.textContent = 'Failed to load raven scrolls. Please try again.';
        }
    }

    function applyFilters() {
        filteredImages = allImages.filter(img => {
            const matchesLetter = currentLetter === 'ALL' || img.folder === currentLetter;
            const matchesSearch = img.name.toLowerCase().includes(searchQuery);
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
            calculateGrid();
            renderVisibleItems();
        }
    }

    function calculateGrid() {
        if (!containerWidth) containerWidth = galleryContainer.clientWidth;
        if (containerWidth === 0) return;

        // Calculate columns based on min-width
        columns = Math.max(1, Math.floor((containerWidth + gap) / (itemMinWidth + gap)));
        const itemWidth = (containerWidth - (gap * (columns - 1))) / columns;

        const rows = Math.ceil(filteredImages.length / columns);
        const totalHeight = rows * itemHeight + Math.max(0, rows - 1) * gap;
        galleryContainer.style.height = `${totalHeight}px`;

        // Update positions of existing rendered items if resize happens
        renderedItems.forEach((item, index) => {
            const r = Math.floor(index / columns);
            const c = index % columns;
            const x = c * (itemWidth + gap);
            const y = r * (itemHeight + gap);
            item.el.style.transform = `translate(${x}px, ${y}px)`;
            item.el.style.width = `${itemWidth}px`;
        });
    }

    function renderVisibleItems() {
        if (filteredImages.length === 0 || columns === 0) return;

        const scrollY = window.scrollY || window.pageYOffset;
        const windowHeight = window.innerHeight;

        // Add a buffer to render items just outside the viewport
        const bufferHeight = windowHeight;
        const renderTop = Math.max(0, scrollY - galleryContainer.offsetTop - bufferHeight);
        const renderBottom = scrollY - galleryContainer.offsetTop + windowHeight + bufferHeight;

        const startRow = Math.max(0, Math.floor(renderTop / (itemHeight + gap)));
        const endRow = Math.min(Math.ceil(filteredImages.length / columns), Math.ceil(renderBottom / (itemHeight + gap)));

        const startIndex = startRow * columns;
        const endIndex = Math.min(filteredImages.length, endRow * columns);

        const newRenderedIndices = new Set();
        const itemWidth = (containerWidth - (gap * (columns - 1))) / columns;

        for (let i = startIndex; i < endIndex; i++) {
            newRenderedIndices.add(i);

            if (!renderedItems.has(i)) {
                const imgData = filteredImages[i];
                const r = Math.floor(i / columns);
                const c = i % columns;

                const el = document.createElement('div');
                el.className = 'gallery-item';
                el.dataset.id = imgData.id;

                const x = c * (itemWidth + gap);
                const y = r * (itemHeight + gap);

                el.style.transform = `translate(${x}px, ${y}px)`;
                el.style.width = `${itemWidth}px`;
                el.style.height = `${itemHeight}px`;
                el.style.position = 'absolute';
                el.style.top = '0';
                el.style.left = '0';

                // Build inner HTML safely using textContent for text nodes later
                el.innerHTML = `
                    <div class="item-image-wrapper">
                        <img data-src="${imgData.thumbnail}" alt="" loading="lazy">
                    </div>
                    <div class="item-info">
                        <div class="item-title"></div>
                        <div class="item-folder"></div>
                    </div>
                `;

                // Set text securely
                const imgNode = el.querySelector('img');
                imgNode.alt = imgData.name;

                const titleNode = el.querySelector('.item-title');
                titleNode.textContent = imgData.name;
                titleNode.title = imgData.name;

                const folderNode = el.querySelector('.item-folder');
                folderNode.textContent = \`Folder \${imgData.folder}\`;

                galleryContainer.appendChild(el);
                renderedItems.set(i, { el, index: i });

                const img = el.querySelector('img');
                imageObserver.observe(img);
            }
        }

        // Cleanup out-of-bounds items to keep DOM light
        for (const [index, item] of renderedItems.entries()) {
            if (!newRenderedIndices.has(index)) {
                const img = item.el.querySelector('img');
                if (img) imageObserver.unobserve(img);
                item.el.remove();
                renderedItems.delete(index);
            }
        }
    }

    function openModal(image) {
        modalImg.src = image.path; // Load full resolution image
        modalCaption.textContent = image.name;
        modal.classList.remove('hidden-modal');
        document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    function closeModal() {
        modal.classList.add('hidden-modal');
        document.body.style.overflow = 'auto';
        setTimeout(() => { modalImg.src = ''; }, 300); // Clear after animation
    }

    init();
});

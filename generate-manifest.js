const fs = require('fs');
const path = require('path');

const rootDir = __dirname;
const outputFilePath = path.join(rootDir, 'images.json');
const folders = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const images = [];

function scanDirectory(currentPath, letter) {
    let entries;
    try {
        entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch (err) {
        return;
    }

    for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        if (entry.isDirectory()) {
            scanDirectory(fullPath, letter);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (allowedExtensions.has(ext)) {
                // Get relative path from root
                const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

                // For thumbnail we can check if a .webp version exists, but if none exists we just use the original image
                // The requirements say "Use WebP thumbnails where possible". Since we aren't generating them here,
                // we'll assume the original is the fallback.
                const thumbnailPath = relativePath.endsWith('.webp') ? relativePath : relativePath.replace(/\.[^/.]+$/, ".webp");
                const hasWebp = fs.existsSync(path.join(rootDir, thumbnailPath));

                images.push({
                    id: relativePath,
                    path: relativePath,
                    thumbnail: hasWebp ? thumbnailPath : relativePath,
                    filename: entry.name,
                    name: entry.name.replace(/\.[^/.]+$/, "").replace(/_/g, ' '),
                    folder: letter
                });
            }
        }
    }
}

for (const folder of folders) {
    const folderPath = path.join(rootDir, folder);
    if (fs.existsSync(folderPath)) {
        scanDirectory(folderPath, folder);
    }
}

fs.writeFileSync(outputFilePath, JSON.stringify(images, null, 2));
console.log(`Successfully generated manifest with ${images.length} images at ${outputFilePath}`);

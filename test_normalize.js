const fs = require('fs');

// old code
function oldNormalizeManifest(data) {
    const out = [];

    function formatPath(p) {
      if (!p) return '';
      let formatted = p;
      if (!formatted.startsWith('./') && !formatted.startsWith('/')) {
        formatted = './' + formatted;
      } else if (formatted.startsWith('/')) {
        formatted = '.' + formatted;
      }
      // Encode URI and strictly encode single quotes to prevent GitHub Pages issues
      return encodeURI(formatted).replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
    }

    // Case A: manifest is already an array of objects
    if (Array.isArray(data)) {
      data.forEach(obj => {
        if (obj && typeof obj === 'object') {
          // ensure required keys exist; fallback to best-effort
          const id = obj.id || obj.path || `${obj.folder || 'A'}/${obj.filename || (obj.name || 'unknown')}`;
          const rawPath = obj.path || obj.id || id;
          const rawThumbnail = obj.thumbnail || rawPath;
          const path = formatPath(rawPath);
          const thumbnail = formatPath(rawThumbnail);
          const name = (obj.name || obj.filename || rawPath.split('/').pop()).replace(/\.[^/.]+$/, '');
          const folderSegments = rawPath.split('/');
          const f = obj.folder || (folderSegments[0] === '.' || folderSegments[0] === '' ? folderSegments[1] : folderSegments[0]) || 'A';
          const folder = f.toUpperCase();
          out.push({ id, path, thumbnail, name, folder });
        }
      });
      return out;
    }

    // Case B: manifest is an object mapping folders -> array (strings or objects)
    if (data && typeof data === 'object') {
      Object.keys(data).forEach(folderKey => {
        const entries = data[folderKey];
        if (!Array.isArray(entries)) return;
        entries.forEach(entry => {
          if (typeof entry === 'string') {
            const rawPath = entry;
            const path = formatPath(rawPath);
            const thumbnail = path;
            const name = rawPath.split('/').pop().replace(/\.[^/.]+$/, '');
            const id = rawPath;
            const folderSegments = rawPath.split('/');
            const f = folderKey || (folderSegments[0] === '.' || folderSegments[0] === '' ? folderSegments[1] : folderSegments[0]) || 'A';
            const folder = f.toUpperCase();
            out.push({ id, path, thumbnail, name, folder });
          } else if (entry && typeof entry === 'object') {
            const id = entry.id || entry.path || `${folderKey}/${entry.filename || entry.name || 'unknown'}`;
            const rawPath = entry.path || entry.id || id;
            const rawThumbnail = entry.thumbnail || rawPath;
            const path = formatPath(rawPath);
            const thumbnail = formatPath(rawThumbnail);
            const name = (entry.name || entry.filename || rawPath.split('/').pop()).replace(/\.[^/.]+$/, '');
            const folderSegments = rawPath.split('/');
            const f = entry.folder || folderKey || (folderSegments[0] === '.' || folderSegments[0] === '' ? folderSegments[1] : folderSegments[0]) || 'A';
            const folder = f.toUpperCase();
            out.push({ id, path, thumbnail, name, folder });
          }
        });
      });
      return out;
    }

    // Unknown format -> return empty
    return out;
}

const { normalizeManifest: newNormalizeManifest } = require('./normalize.js');

const testCases = [
  // Case A: array of objects
  [
    {path: "A/Aegon's_wars1.png"},
    {path: "A/A (Test).jpg"},
    {path: "/B/Test.png"},
    {path: "./C/Test.png"},
    {filename: "hello.png", folder: "D"}
  ],
  // Case B: object mapping folders -> array
  {
    "A": ["A/1.png", "A/2.png"],
    "B": [{path: "B/1.png"}, {filename: "2.png"}]
  },
  // Case A but with string (new behavior support)
  [
    "A/1.png",
    {path: "B/2.png"}
  ]
];

const assert = require('assert');
testCases.forEach((tc, i) => {
  const oldRes = oldNormalizeManifest(tc);
  const newRes = newNormalizeManifest(tc);

  // Since old res doesn't support strings in array, let's filter out strings for comparison in case A with strings
  // but for the others it should be identical
  console.log(`Test case ${i}:`);
  console.log('Old:', oldRes);
  console.log('New:', newRes);
  try {
    // Only strictly compare if we aren't testing the new string-in-array feature
    if (i !== 2) {
      assert.deepStrictEqual(oldRes, newRes);
      console.log('✅ Matched!');
    } else {
      console.log('✅ New output:', newRes);
    }
  } catch(e) {
    console.log('❌ MISMATCH');
  }
});

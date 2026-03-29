// Normalize manifest into array of objects with required fields
function normalizeManifest(data) {
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

  function normalizeEntry(entry, defaultFolderKey = null) {
    if (typeof entry === 'string') {
      const rawPath = entry;
      const path = formatPath(rawPath);
      const thumbnail = path;
      const name = rawPath.split('/').pop().replace(/\.[^/.]+$/, '');
      const id = rawPath;
      const folderSegments = rawPath.split('/');
      const f = defaultFolderKey || (folderSegments[0] === '.' || folderSegments[0] === '' ? folderSegments[1] : folderSegments[0]) || 'A';
      const folder = f.toUpperCase();
      return { id, path, thumbnail, name, folder };
    }

    if (entry && typeof entry === 'object') {
      // ensure required keys exist; fallback to best-effort
      const id = entry.id || entry.path || `${entry.folder || defaultFolderKey || 'A'}/${entry.filename || entry.name || 'unknown'}`;
      const rawPath = entry.path || entry.id || id;
      const rawThumbnail = entry.thumbnail || rawPath;
      const path = formatPath(rawPath);
      const thumbnail = formatPath(rawThumbnail);
      const name = (entry.name || entry.filename || rawPath.split('/').pop()).replace(/\.[^/.]+$/, '');
      const folderSegments = rawPath.split('/');
      const f = entry.folder || defaultFolderKey || (folderSegments[0] === '.' || folderSegments[0] === '' ? folderSegments[1] : folderSegments[0]) || 'A';
      const folder = f.toUpperCase();
      return { id, path, thumbnail, name, folder };
    }

    return null;
  }

  // Case A: manifest is already an array of objects
  if (Array.isArray(data)) {
    data.forEach(obj => {
      const normalized = normalizeEntry(obj);
      if (normalized) out.push(normalized);
    });
    return out;
  }

  // Case B: manifest is an object mapping folders -> array (strings or objects)
  if (data && typeof data === 'object') {
    Object.keys(data).forEach(folderKey => {
      const entries = data[folderKey];
      if (!Array.isArray(entries)) return;
      entries.forEach(entry => {
        const normalized = normalizeEntry(entry, folderKey);
        if (normalized) out.push(normalized);
      });
    });
    return out;
  }

  // Unknown format -> return empty
  return out;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { normalizeManifest };
}

// Main-world script: intercepts Substack feed API responses to cache full text.
// Substack sends complete note/comment body_json in the API response, but truncates
// at render time. This patches fetch() to capture the full text before it enters
// Preact's closure and becomes inaccessible.

(() => {
  const cache = new Map(); // noteId -> full text string

  const BLOCK_NODES = new Set([
    'paragraph',
    'heading',
    'blockquote',
    'bullet_list',
    'ordered_list',
    'list_item',
    'code_block',
    'horizontal_rule',
  ]);

  const extractText = node => {
    if (!node) return '';
    let text = '';
    if (node.text) text += node.text;
    if (Array.isArray(node.content)) {
      for (const child of node.content) {
        text += extractText(child);
      }
    }
    if (BLOCK_NODES.has(node.type) && text && !text.endsWith('\n')) text += '\n';
    return text;
  };

  const processItems = items => {
    if (!Array.isArray(items)) return;
    for (const item of items) {
      const note = item.comment || item.note;
      if (note && note.id && note.body_json) {
        const fullText = extractText(note.body_json);
        if (fullText.length > 0) {
          cache.set(String(note.id), fullText);
        }
      }
    }
  };

  // Patch fetch to intercept Substack feed responses
  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';

    if (url.includes('/api/v1/reader/feed')) {
      try {
        const cloned = response.clone();
        const data = await cloned.json();
        processItems(data.items);
        // eslint-disable-next-line no-empty
      } catch {}
    }

    return response;
  };

  // Backfill: re-fetch any feed URLs that loaded before this script was injected
  try {
    const entries = performance.getEntriesByType('resource');
    const feedUrls = entries.filter(e => e.name.includes('/api/v1/reader/feed')).map(e => e.name);
    for (const feedUrl of feedUrls) {
      originalFetch(feedUrl)
        .then(r => r.json())
        .then(data => processItems(data.items))
        .catch(() => {});
    }
    // eslint-disable-next-line no-empty
  } catch {}

  // Content script queries cache via custom event + data attributes
  document.addEventListener('pangram-substack-lookup', () => {
    const els = document.querySelectorAll('[data-pangram-substack-request]');
    els.forEach(el => {
      const prefix = el.getAttribute('data-pangram-substack-request');
      el.removeAttribute('data-pangram-substack-request');

      if (!prefix) return;

      // Match by text prefix — the DOM has truncated text, find the cached full text
      // that starts with the same characters
      for (const [_noteId, fullText] of cache) {
        // Normalize both for comparison (collapse whitespace, trim)
        const normalizedFull = fullText.replace(/\s+/g, ' ').trim();
        const normalizedPrefix = prefix.replace(/\s+/g, ' ').trim();

        if (
          normalizedFull.startsWith(normalizedPrefix.slice(0, 100)) &&
          normalizedFull.length > normalizedPrefix.length
        ) {
          el.setAttribute('data-pangram-substack-fulltext', fullText);
          return;
        }
      }
    });
  });
})();

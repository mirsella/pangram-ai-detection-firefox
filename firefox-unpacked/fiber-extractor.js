// Main-world script: extracts full tweet text from React fiber internals.
// Content scripts can't access JS expando properties like __reactFiber,
// so this runs in the page's main world and communicates via data attributes.
document.addEventListener('pangram-extract-fiber', () => {
  const els = document.querySelectorAll('[data-pangram-fiber-request]');
  els.forEach(el => {
    el.removeAttribute('data-pangram-fiber-request');
    const fiberKey = Object.keys(el).find(k => k.startsWith('__reactFiber'));
    if (!fiberKey) return;
    let fiber = el[fiberKey];
    for (let i = 0; i < 40 && fiber; i++) {
      const props = fiber.memoizedProps;
      if (
        props &&
        props.context &&
        typeof props.context === 'object' &&
        'text' in props.context &&
        'is_expandable' in props.context
      ) {
        const text = props.context.text;
        if (typeof text === 'string' && text.length > 0) {
          el.setAttribute('data-pangram-fiber-text', text);
          return;
        }
      }
      fiber = fiber.return;
    }
  });
});

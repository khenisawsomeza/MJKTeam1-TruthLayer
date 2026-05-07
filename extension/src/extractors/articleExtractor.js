/**
 * TruthLayer - Content Extraction Script
 * Injected on-demand into the active tab to extract readable article text.
 * Returns { url, content } to the caller.
 */
(function () {
  // Selectors ordered by specificity — the first match wins
  const ARTICLE_SELECTORS = [
    'article',
    '[role="article"]',
    '.post-content',
    '.article-body',
    '.article-content',
    '.entry-content',
    '.story-body',
    '.post-body',
    'main',
    '#content',
    '.content'
  ];

  // Elements to strip out before extracting text
  const NOISE_SELECTORS = [
    'nav', 'header', 'footer', 'aside',
    '.sidebar', '.nav', '.menu', '.ad', '.advertisement',
    '.social-share', '.comments', '.related-posts',
    'script', 'style', 'noscript', 'iframe',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]'
  ];

  function cleanText(text) {
    return text
      .replace(/\s+/g, ' ')       // collapse whitespace
      .replace(/\n{3,}/g, '\n\n') // collapse excessive newlines
      .trim();
  }

  function extractFromContainer(container) {
    // Clone so we don't mutate the real DOM
    const clone = container.cloneNode(true);

    // Remove noise elements
    NOISE_SELECTORS.forEach(sel => {
      clone.querySelectorAll(sel).forEach(el => el.remove());
    });

    // Collect text from paragraphs for cleaner output
    const paragraphs = clone.querySelectorAll('p');
    if (paragraphs.length >= 3) {
      return Array.from(paragraphs)
        .map(p => p.textContent.trim())
        .filter(t => t.length > 20)
        .join('\n\n');
    }

    // Fallback: full text content
    return clone.textContent;
  }

  function extract() {
    // Try each article selector
    for (const selector of ARTICLE_SELECTORS) {
      const el = document.querySelector(selector);
      if (el) {
        const text = cleanText(extractFromContainer(el));
        if (text.length >= 50) {
          return text;
        }
      }
    }

    // Final fallback: collect all <p> tags on the page
    const allParagraphs = document.querySelectorAll('p');
    if (allParagraphs.length >= 2) {
      const text = Array.from(allParagraphs)
        .map(p => p.textContent.trim())
        .filter(t => t.length > 20)
        .join('\n\n');
      if (text.length >= 50) {
        return cleanText(text);
      }
    }

    return null;
  }

  const content = extract();

  // Truncate to ~5000 chars to keep API payloads reasonable
  const trimmed = content ? content.substring(0, 5000) : null;

  return {
    url: window.location.href,
    title: document.title,
    content: trimmed
  };
})();

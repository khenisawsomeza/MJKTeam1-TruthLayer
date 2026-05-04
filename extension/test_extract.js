const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(require('path').resolve(__dirname, '..', 'fbpost.html'), 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Find a reasonable post container
let post = document.querySelector('[role="article"]') || document.querySelector('[data-pagelet*="FeedUnit"]') || document.querySelector('div[data-ad-rendering-role="profile_name"]')?.closest('[role="article"]') || document;

function extractAuthor(postElement) {
    if (!postElement) return null;

    const selectors = [
        'div[data-ad-rendering-role="profile_name"] a',
        'div[data-ad-rendering-role="profile_name"] h4 a',
        'h4 a',
        'header h4 a',
        'a[aria-label^="Hide post by"]',
        'a[role="link"]',
        'a'
    ];

    for (const sel of selectors) {
        const el = postElement.querySelector(sel);
        if (!el) continue;

        let name = (el.textContent || '').trim();
        if (!name) {
            name = el.getAttribute('title') || el.getAttribute('aria-label') || '';
            name = name.trim();
        }

        let url = el.getAttribute('href') || el.getAttribute('data-href') || null;
        if (url) {
            try { url = new URL(url, 'https://www.facebook.com').href; } catch (e) { }
        }

        if (name) return { name, url };
    }

    return null;
}

const result = extractAuthor(post);
console.log('extractAuthor result:', JSON.stringify(result, null, 2));

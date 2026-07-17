const test = require('node:test');
const assert = require('node:assert/strict');

const { buildOgHtml, escapeHtml, DEFAULT_OG_IMAGE, DEFAULT_TITLE, DEFAULT_DESCRIPTION } =
  require('../controllers/og');

test('buildOgHtml — includes escaped og/twitter tags, canonical url, and refresh redirect', () => {
  const html = buildOgHtml({
    canonicalUrl: 'https://banatalk.com/moment/1',
    title: 'A <script>alert(1)</script> title',
    description: 'A "quoted" & special description',
    image: 'https://x.cdn.digitaloceanspaces.com/y.jpg',
  });

  // og tags present with escaped values
  assert.match(html, /<meta property="og:type" content="website">/);
  assert.match(
    html,
    /<meta property="og:title" content="A &lt;script&gt;alert\(1\)&lt;\/script&gt; title">/
  );
  assert.match(
    html,
    /<meta property="og:description" content="A &quot;quoted&quot; &amp; special description">/
  );
  assert.match(
    html,
    /<meta property="og:image" content="https:\/\/x\.cdn\.digitaloceanspaces\.com\/y\.jpg">/
  );
  assert.match(html, /<meta property="og:url" content="https:\/\/banatalk\.com\/moment\/1">/);

  // twitter card tags present
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.match(html, /<meta name="twitter:title"/);
  assert.match(html, /<meta name="twitter:image"/);

  // canonical link + meta-refresh redirect + human fallback link
  assert.match(html, /<link rel="canonical" href="https:\/\/banatalk\.com\/moment\/1">/);
  assert.match(
    html,
    /<meta http-equiv="refresh" content="0; url=https:\/\/banatalk\.com\/moment\/1">/
  );
  assert.match(html, /<a href="https:\/\/banatalk\.com\/moment\/1">/);

  // no raw unescaped script tag anywhere (XSS safety)
  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test('buildOgHtml — falls back to defaults when title/description/image are missing', () => {
  const html = buildOgHtml({ canonicalUrl: 'https://banatalk.com/profile/2' });

  assert.ok(html.includes(`<meta property="og:title" content="${escapeHtml(DEFAULT_TITLE)}">`));
  assert.ok(
    html.includes(`<meta property="og:description" content="${escapeHtml(DEFAULT_DESCRIPTION)}">`)
  );
  assert.ok(html.includes(`<meta property="og:image" content="${escapeHtml(DEFAULT_OG_IMAGE)}">`));
});

test('escapeHtml — escapes all five reserved characters', () => {
  assert.equal(escapeHtml(`& < > " '`), '&amp; &lt; &gt; &quot; &#39;');
});

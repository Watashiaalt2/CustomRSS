// generate-rss.js
const fs = require('fs');

const API_URL = 'https://www.zaobao.com.sg/_plat/api/v2/client/site-search';
const SEARCH = { searchTerm: '刘怡伶', page: 1, pageSize: 100, sort: 'date' };
const SITE_URL = 'https://Watashiaalt2.github.io/CustomRSS/';
const FEED_URL = `${SITE_URL}feed.xml`;

const escapeXml = (s = '') =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

// CDATA can't contain "]]>", so split it across two sections if present
const cdata = (s = '') => `<![CDATA[${String(s).replace(/]]>/g, ']]]]><![CDATA[>')}]]>`;

async function buildFeed() {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; CustomRSS/1.0; +https://github.com/Watashiaalt2/CustomRSS)',
      },
      body: JSON.stringify(SEARCH),
    });
    if (!response.ok) throw new Error(`API responded ${response.status} ${response.statusText}`);

    const json = await response.json();
    const articles = json?.data?.articles;
    if (!Array.isArray(articles)) throw new Error(`Unexpected API response: ${JSON.stringify(json).slice(0, 500)}`);

    // Response shape: { id, title, timestamp (unix seconds), thumbnail, category_label, summary, item_type, href }
    const items = articles
      .sort((a, b) => b.timestamp - a.timestamp)
      .map(item => `
    <item>
      <title>${cdata(item.title)}</title>
      <link>${escapeXml(item.href)}</link>
      <guid isPermaLink="false">zaobao-${escapeXml(item.id)}</guid>
      <pubDate>${new Date(item.timestamp * 1000).toUTCString()}</pubDate>
      <category>${escapeXml(item.category_label)}</category>
      <description>${cdata(item.summary)}</description>${item.thumbnail ? `
      <media:thumbnail url="${escapeXml(item.thumbnail)}" />` : ''}
    </item>`)
      .join('');

    // Use the newest article's date so the file only changes when there is new content
    const lastBuildDate = articles.length ? new Date(articles[0].timestamp * 1000) : new Date();

    const rssFeed = `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>联合早报 · ${escapeXml(SEARCH.searchTerm)}</title>
    <link>${SITE_URL}</link>
    <description>联合早报 search results for “${escapeXml(SEARCH.searchTerm)}”</description>
    <language>zh-cn</language>
    <lastBuildDate>${lastBuildDate.toUTCString()}</lastBuildDate>
    <atom:link href="${FEED_URL}" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>
`;

    fs.writeFileSync('feed.xml', rssFeed);
    console.log(`RSS feed generated with ${articles.length} items.`);
  } catch (error) {
    console.error('Error generating feed:', error);
    process.exit(1);
  }
}

buildFeed();

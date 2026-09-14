// Vercel turns any file in /api into a live endpoint automatically — this
// one is reachable at https://your-site.com/api/rss once deployed. It reads
// the same Supabase project the site already uses (same env vars), so no
// extra setup is needed beyond what's already in Vercel's project settings.

function escapeXml(str) {
  return String(str || '').replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case "'": return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export default async function handler(req, res) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(500).send('Missing Supabase environment variables.');
    return;
  }

  const siteUrl = `https://${req.headers['x-forwarded-host'] || req.headers.host}`;

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/articles?select=id,title,excerpt,category,created_at&order=created_at.desc&limit=20`,
      {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      }
    );
    if (!response.ok) throw new Error(`Supabase error ${response.status}`);
    const articles = await response.json();

    const items = articles
      .map((a) => {
        const link = `${siteUrl}/#post-${a.id}`;
        const pubDate = new Date(a.created_at).toUTCString();
        return `
    <item>
      <title>${escapeXml(a.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="false">${a.id}</guid>
      <pubDate>${pubDate}</pubDate>
      <category>${escapeXml(a.category)}</category>
      <description>${escapeXml(a.excerpt)}</description>
    </item>`;
      })
      .join('');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Dispatch</title>
    <link>${siteUrl}</link>
    <description>Dispatch — a small publication</description>${items}
  </channel>
</rss>`;

    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.status(200).send(xml);
  } catch (e) {
    res.status(500).send(`Could not build the feed: ${e.message}`);
  }
}

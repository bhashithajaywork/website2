import { createClient } from '@supabase/supabase-js';

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY,
  SITE_URL,
  FB_PAGE_ID,
  FB_PAGE_ACCESS_TOKEN,
} = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !GEMINI_API_KEY) {
  console.error('Missing one of SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY.');
  process.exit(1);
}

// Google's rolling "latest flash" alias — it keeps working as Google ships
// new versions, so this shouldn't need edits. If it ever errors out, check
// https://ai.google.dev/gemini-api/docs/models for the current free-tier
// model name and put it here instead.
const MODEL = 'gemini-flash-latest';

// Edit this list to change what the site writes about.
const CATEGORIES = [
  'Living',
  'Work',
  'Culture',
  'Technology',
  'Health & Wellness',
  'Travel',
  'Food',
  'Finance',
  'Sports',
];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Pollinations.ai generates the actual image, for free, with no account or
// API key — hitting this URL returns the image itself, so it can be stored
// directly as image_url and used straight in an <img src="..."> tag.
function buildImageUrl(imagePrompt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(imagePrompt);
  return `https://image.pollinations.ai/prompt/${encoded}?model=flux&enhance=true&width=1200&height=630&seed=${seed}&nologo=true`;
}

// Posting to Facebook is optional — if the secrets aren't set, this is
// skipped quietly. If it fails for any reason, we log a warning but never
// throw, so a Facebook hiccup can never stop the blog post itself from
// being published.
async function postToFacebook(post, link, imageUrl) {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) return;
  const caption = `${post.title}\n\n${post.excerpt}\n\n${link}`;
  try {
    if (imageUrl) {
      // Attach the actual cover image to the post, not just a link.
      const url = `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/photos`;
      const body = new URLSearchParams({ url: imageUrl, caption, access_token: FB_PAGE_ACCESS_TOKEN });
      const response = await fetch(url, { method: 'POST', body });
      if (!response.ok) {
        console.warn('Facebook photo post failed:', await response.text());
      } else {
        console.log('Posted to Facebook (with image).');
      }
    } else {
      const url = `https://graph.facebook.com/v21.0/${FB_PAGE_ID}/feed`;
      const body = new URLSearchParams({
        message: `${post.title}\n\n${post.excerpt}`,
        link,
        access_token: FB_PAGE_ACCESS_TOKEN,
      });
      const response = await fetch(url, { method: 'POST', body });
      if (!response.ok) {
        console.warn('Facebook post failed:', await response.text());
      } else {
        console.log('Posted to Facebook (link only, no image).');
      }
    }
  } catch (e) {
    console.warn('Facebook post failed:', e.message);
  }
}

async function getRecentTitles() {
  const { data, error } = await supabase
    .from('articles')
    .select('title')
    .order('created_at', { ascending: false })
    .limit(15);
  if (error) {
    console.warn('Could not fetch recent titles:', error.message);
    return [];
  }
  return (data || []).map((a) => a.title);
}

async function generatePost(category, recentTitles) {
  const avoidList = recentTitles.length
    ? `Avoid repeating these recent titles or writing about the same specific topic as any of them:\n${recentTitles
        .map((t) => `- ${t}`)
        .join('\n')}\n\n`
    : '';

  const prompt = `You write short, thoughtful blog posts for a small independent Sri Lankan publication called "Dispatch". Write the title, excerpt, and content entirely in Sinhala (සිංහල script) — natural, everyday Sinhala, not overly formal or literary. The tone is calm, specific, and personal, like a smart friend thinking out loud. Not a listicle, not a press release, no clickbait.

Write one new post in the "${category}" category.

If the category is Finance or Health & Wellness, keep it reflective and general — personal observations and everyday context, not specific investment advice, medical advice, or dosage recommendations.

${avoidList}Return ONLY a JSON object, with no other text and no markdown code fences, in exactly this shape:
{
  "title": "a specific, understated title, in Sinhala",
  "excerpt": "one or two sentences in Sinhala, under 30 words",
  "content": "3 to 4 short paragraphs in Sinhala, separated by a blank line, no headers, no bullet points",
  "image_prompt": "a short, concrete visual description (10-20 words, in English) for an editorial photo or illustration to go with this post — describe a real scene, no text or words in the image, no logos"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const options = {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  };

  const delays = [5000, 15000, 30000, 60000, 60000];
  let lastError;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const response = await fetch(url, options);
    if (response.ok) {
      const data = await response.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const text = parts.map((p) => p.text || '').join('');
      if (!text) throw new Error('No text in the Gemini response.');
      const cleaned = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleaned);
    }
    const bodyText = await response.text();
    lastError = new Error(`Gemini API error ${response.status}: ${bodyText}`);
    const retryable = response.status === 503 || response.status === 429;
    if (!retryable || attempt === delays.length) throw lastError;
    console.warn(`Gemini API busy (${response.status}), retrying in ${delays[attempt] / 1000}s…`);
    await new Promise((r) => setTimeout(r, delays[attempt]));
  }
  throw lastError;
}

async function main() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const recentTitles = await getRecentTitles();
  const post = await generatePost(category, recentTitles);
  const imageUrl = post.image_prompt ? buildImageUrl(post.image_prompt) : null;

  const { data: inserted, error } = await supabase
    .from('articles')
    .insert([
      {
        title: post.title,
        category,
        excerpt: post.excerpt,
        content: post.content,
        image_url: imageUrl,
        date: new Date().toISOString().slice(0, 10),
      },
    ])
    .select()
    .single();

  if (error) throw error;
  console.log(`Published: "${post.title}" (${category})`);

  if (SITE_URL) {
    const link = `${SITE_URL.replace(/\/$/, '')}/#post-${inserted.id}`;
    await postToFacebook(post, link, imageUrl);
  }
}

main().catch((err) => {
  console.error('Auto-post failed:', err);
  process.exit(1);
});

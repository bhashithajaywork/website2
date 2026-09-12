import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY } = process.env;

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
const CATEGORIES = ['Living', 'Work', 'Culture'];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Pollinations.ai generates the actual image, for free, with no account or
// API key — hitting this URL returns the image itself, so it can be stored
// directly as image_url and used straight in an <img src="..."> tag.
function buildImageUrl(imagePrompt) {
  const seed = Math.floor(Math.random() * 1_000_000);
  const encoded = encodeURIComponent(imagePrompt);
  return `https://image.pollinations.ai/prompt/${encoded}?width=1200&height=630&seed=${seed}&nologo=true`;
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

  const prompt = `You write short, thoughtful blog posts for a small independent publication called "Dispatch". The tone is calm, specific, and personal, like a smart friend thinking out loud. Not a listicle, not a press release, no clickbait.

Write one new post in the "${category}" category.

${avoidList}Return ONLY a JSON object, with no other text and no markdown code fences, in exactly this shape:
{
  "title": "a specific, understated title",
  "excerpt": "one or two sentences, under 30 words",
  "content": "3 to 4 short paragraphs separated by a blank line, no headers, no bullet points",
  "image_prompt": "a short, concrete visual description (10-20 words) for an editorial photo or illustration to go with this post — describe a real scene, no text or words in the image, no logos"
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY,
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const text = parts.map((p) => p.text || '').join('');
  if (!text) throw new Error('No text in the Gemini response.');

  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

async function main() {
  const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
  const recentTitles = await getRecentTitles();
  const post = await generatePost(category, recentTitles);

  const { error } = await supabase.from('articles').insert([
    {
      title: post.title,
      category,
      excerpt: post.excerpt,
      content: post.content,
      image_url: post.image_prompt ? buildImageUrl(post.image_prompt) : null,
      date: new Date().toISOString().slice(0, 10),
    },
  ]);

  if (error) throw error;
  console.log(`Published: "${post.title}" (${category})`);
}

main().catch((err) => {
  console.error('Auto-post failed:', err);
  process.exit(1);
});

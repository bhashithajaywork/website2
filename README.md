# Dispatch — setup guide

This is the custom "Dispatch" blog/news site, wired up to a real database (Supabase)
so it can go live on the internet with your own domain.

## 1. Create a Supabase project

1. Go to https://supabase.com and sign up (free).
2. Click **New project**. Pick any name and a database password (save this password somewhere).
3. Wait a minute or two for the project to finish setting up.

## 2. Create the articles table

In your Supabase project, open **SQL Editor** (left sidebar) → **New query**, paste this, and click **Run**:

```sql
create table articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  category text not null default 'General',
  excerpt text,
  content text not null,
  image_url text,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

alter table articles enable row level security;

create policy "Public can read articles"
  on articles for select
  to anon
  using (true);

create policy "Signed-in users can insert articles"
  on articles for insert
  to authenticated
  with check (true);

create policy "Signed-in users can update articles"
  on articles for update
  to authenticated
  using (true);

create policy "Signed-in users can delete articles"
  on articles for delete
  to authenticated
  using (true);
```

This lets anyone read articles (so the public site works), but only a signed-in
user can add, edit, or delete them (so Admin is actually protected).

> **Already created your table before?** Just add the new column instead of
> running the block above again:
> ```sql
> alter table articles add column image_url text;
> ```

### Optional: seed a few starter posts

```sql
insert into articles (title, category, excerpt, content, date) values
('Welcome to Dispatch', 'Notes',
 'A starter post. Edit or delete it from Admin, and publish something of your own.',
 'This site ships with a couple of placeholder posts so you can see how things look with real content in place.

Sign in to Admin to edit or delete anything here, or write something new.',
 current_date),
('The case for a slower morning routine', 'Living',
 'A few small changes made the first hour of the day feel less like a scramble.',
 'For most of last year, my mornings started with a phone screen.

The change was almost boring: phone stays outside the bedroom, kettle goes on first, and the first twenty minutes belong to nothing in particular.',
 current_date - 2);
```

## 3. Create your admin login

In Supabase, go to **Authentication → Users → Add user → Create new user**.
Use your own email and a password you'll remember — this is what you'll use to
sign in to Admin on the live site. Untick "Auto confirm user" is fine to leave
checked so it's ready immediately.

## 4. Get your API keys

Go to **Project Settings → API**. You'll need two values:
- **Project URL**
- **anon public** key

## 5. Set up the project locally (optional but recommended)

You'll need [Node.js](https://nodejs.org) installed (v18 or newer).

```bash
cd dispatch-blog
cp .env.example .env
```

Open `.env` and paste in your Project URL and anon key from step 4. Then:

```bash
npm install
npm run dev
```

This opens the site at `http://localhost:5173` so you can check everything
works — home page, an article, and signing in to Admin — before going live.

## 6. Push the code to GitHub

1. Create a free account at https://github.com if you don't have one.
2. Create a new, empty repository (no README/license — this project already has one).
3. In your project folder:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPO.git
git push -u origin main
```

(`.env` is in `.gitignore`, so your keys won't be uploaded — good, since the
anon key is meant to be public but it's still good practice to set it as an
environment variable per deployment rather than commit it.)

## 7. Deploy on Vercel

1. Go to https://vercel.com and sign up with your GitHub account (free).
2. Click **Add New → Project**, and import the repository you just pushed.
3. Vercel will detect it's a Vite project automatically. Before deploying, open
   **Environment Variables** and add:
   - `VITE_SUPABASE_URL` → your Project URL
   - `VITE_SUPABASE_ANON_KEY` → your anon key
4. Click **Deploy**. In about a minute you'll get a live URL like
   `dispatch-blog.vercel.app`.

## 8. Connect a custom domain

1. Buy a domain if you don't have one (Namecheap, Google Domains, etc. — usually $10–20/year).
2. In your Vercel project, go to **Settings → Domains**, and add your domain.
3. Vercel will show DNS records to add. Go to your domain registrar's DNS
   settings and add those records.
4. Within a few hours (often much sooner) your domain will point to the live site.

## Everyday use

- Visit your live site, click **Admin** in the footer, and sign in with the
  email/password from step 3.
- **New post** to publish, the pencil icon to edit, the trash icon to delete.
- Every change updates the database immediately — no redeploying needed for content.
- To change the design later, edit `src/App.jsx` and push to GitHub; Vercel
  redeploys automatically.

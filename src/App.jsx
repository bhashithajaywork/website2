import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Lock, Pencil, Trash2, Plus, LogOut } from 'lucide-react';
import { supabase } from './supabaseClient';

function formatDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export default function App() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');

  const [view, setView] = useState('home');
  const [activeId, setActiveId] = useState(null);

  const [session, setSession] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ title: '', category: '', excerpt: '', content: '', date: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const fetchArticles = useCallback(async () => {
    const { data, error } = await supabase
      .from('articles')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return data || [];
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchArticles();
        if (!cancelled) setArticles(data);
      } catch (e) {
        if (!cancelled) setLoadError('Could not load articles. Check your Supabase setup and reload.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchArticles]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthChecked(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const sorted = useMemo(
    () => [...articles].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [articles]
  );
  const categories = useMemo(
    () => [...new Set(articles.map((a) => a.category).filter(Boolean))],
    [articles]
  );
  const active = useMemo(() => articles.find((a) => a.id === activeId) || null, [articles, activeId]);

  function openArticle(id) {
    setActiveId(id);
    setView('article');
    window.scrollTo(0, 0);
  }
  function goHome() {
    setView('home');
    setActiveId(null);
    setEditingId(null);
  }
  function openAdmin() {
    setView('admin');
    window.scrollTo(0, 0);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoggingIn(true);
    setLoginError('');
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoggingIn(false);
    if (error) {
      setLoginError('Email or password is not right.');
    } else {
      setLoginPassword('');
    }
  }
  async function handleLogout() {
    await supabase.auth.signOut();
    setEditingId(null);
  }

  function openNewForm() {
    setForm({
      title: '',
      category: '',
      excerpt: '',
      content: '',
      date: new Date().toISOString().slice(0, 10),
    });
    setFormError('');
    setEditingId('new');
  }
  function openEditForm(article) {
    setForm({
      title: article.title,
      category: article.category,
      excerpt: article.excerpt || '',
      content: article.content,
      date: article.date,
    });
    setFormError('');
    setEditingId(article.id);
  }
  function cancelForm() {
    setEditingId(null);
    setFormError('');
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      setFormError('Give the post a title and some content before saving.');
      return;
    }
    setSaving(true);
    setFormError('');
    setSaveError('');

    const payload = {
      title: form.title.trim(),
      category: form.category.trim() || 'General',
      excerpt: form.excerpt.trim() || form.content.trim().slice(0, 140),
      content: form.content.trim(),
      date: form.date || new Date().toISOString().slice(0, 10),
    };

    try {
      if (editingId === 'new') {
        const { error } = await supabase.from('articles').insert([payload]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('articles').update(payload).eq('id', editingId);
        if (error) throw error;
      }
      const data = await fetchArticles();
      setArticles(data);
      setEditingId(null);
    } catch (e) {
      setSaveError('That change could not be saved. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    try {
      const { error } = await supabase.from('articles').delete().eq('id', id);
      if (error) throw error;
      const data = await fetchArticles();
      setArticles(data);
      setPendingDelete(null);
      if (activeId === id) goHome();
    } catch (e) {
      setSaveError('That post could not be deleted. Try again.');
    }
  }

  return (
    <div className="dispatch-root">
      <style>{`
        .dispatch-root {
          --bg: #fcfbf9;
          --ink: #17181c;
          --ink-soft: #55575f;
          --ink-faint: #8b8d94;
          --accent: #1f4b99;
          --line: #e6e4de;
          --surface: #f3f2ee;
          --danger: #a33a2c;
          font-family: 'Inter', -apple-system, sans-serif;
          background: var(--bg);
          color: var(--ink);
          min-height: 100vh;
          line-height: 1.5;
        }
        .dispatch-root * { box-sizing: border-box; }
        .dispatch-root :focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
        .d-shell { max-width: 760px; margin: 0 auto; padding: 0 24px; }
        .d-header { padding: 40px 0 20px; }
        .d-header-row { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .d-mast {
          background: none; border: none; padding: 0; cursor: pointer;
          font-family: 'Fraunces', Georgia, serif; font-weight: 600;
          font-size: clamp(28px, 4vw, 36px); letter-spacing: -0.01em; color: var(--ink);
        }
        .d-dateline { font-size: 13px; color: var(--ink-faint); }
        .d-rule { border: none; border-top: 1px solid var(--line); margin: 20px 0 0; }
        .d-main { padding: 36px 0 80px; }
        .d-hero-cat { color: var(--accent); font-size: 13px; font-weight: 600; margin-bottom: 10px; }
        .d-hero-title { font-size: clamp(30px, 5vw, 44px); line-height: 1.12; font-weight: 600; margin: 0 0 14px; cursor: pointer; font-family: 'Fraunces', Georgia, serif; }
        .d-hero-title:hover { color: var(--accent); }
        .d-hero-excerpt { font-size: 18px; color: var(--ink-soft); max-width: 62ch; margin: 0 0 10px; }
        .d-hero-date { font-size: 13px; color: var(--ink-faint); }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (prefers-reduced-motion: no-preference) { .d-hero { animation: fadeUp 0.55s ease both; } }
        .d-list { margin-top: 44px; }
        .d-row { padding: 26px 0; border-top: 1px solid var(--line); cursor: pointer; }
        .d-row:last-child { border-bottom: 1px solid var(--line); }
        .d-row-cat { color: var(--accent); font-size: 13px; font-weight: 600; margin-bottom: 6px; }
        .d-row-title { font-size: 22px; font-weight: 600; margin: 0 0 8px; line-height: 1.3; font-family: 'Fraunces', Georgia, serif; }
        .d-row:hover .d-row-title { color: var(--accent); }
        .d-row-excerpt { color: var(--ink-soft); font-size: 15px; max-width: 62ch; margin: 0 0 8px; }
        .d-row-date { font-size: 12.5px; color: var(--ink-faint); }
        .d-empty { padding: 60px 0; text-align: center; color: var(--ink-soft); }
        .d-back { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; color: var(--ink-soft); font-size: 14px; padding: 0; cursor: pointer; margin-bottom: 28px; }
        .d-back:hover { color: var(--accent); }
        .d-article-cat { color: var(--accent); font-size: 13px; font-weight: 600; margin-bottom: 12px; }
        .d-article-title { font-size: clamp(30px, 5vw, 42px); line-height: 1.15; font-weight: 600; margin: 0 0 14px; max-width: 20ch; font-family: 'Fraunces', Georgia, serif; }
        .d-article-date { color: var(--ink-faint); font-size: 13px; margin-bottom: 36px; }
        .d-article-body p { font-size: 18px; line-height: 1.75; color: #26272c; max-width: 66ch; margin: 0 0 22px; }
        .d-footer { border-top: 1px solid var(--line); padding: 22px 0 50px; }
        .d-footer-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; color: var(--ink-faint); }
        .d-link-btn { background: none; border: none; color: var(--ink-faint); font-size: 13px; cursor: pointer; padding: 0; text-decoration: underline; text-underline-offset: 3px; }
        .d-link-btn:hover { color: var(--accent); }
        .d-banner { background: #fdf1ee; border: 1px solid #f0cfc6; color: var(--danger); font-size: 14px; padding: 12px 16px; border-radius: 4px; margin-bottom: 24px; }
        .d-login { max-width: 340px; margin: 60px auto; text-align: center; }
        .d-login-icon { width: 36px; height: 36px; margin: 0 auto 18px; color: var(--ink-faint); }
        .d-login h2 { font-size: 22px; margin: 0 0 6px; font-family: 'Fraunces', Georgia, serif; }
        .d-login p { color: var(--ink-soft); font-size: 14px; margin: 0 0 24px; }
        .d-field { text-align: left; margin-bottom: 16px; }
        .d-field label { display: block; font-size: 13px; color: var(--ink-soft); margin-bottom: 6px; }
        .d-field input, .d-field textarea {
          width: 100%; border: 1px solid var(--line); background: #fff; border-radius: 4px;
          padding: 10px 12px; font-size: 15px; color: var(--ink); font-family: inherit;
        }
        .d-field textarea { resize: vertical; }
        .d-field input:focus, .d-field textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }
        .d-error { color: var(--danger); font-size: 13px; margin: -8px 0 16px; }
        .d-btn { display: inline-flex; align-items: center; gap: 6px; border: none; border-radius: 4px; padding: 10px 18px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .d-btn-primary { background: var(--accent); color: #fff; }
        .d-btn-primary:hover { background: #17386f; }
        .d-btn-primary:disabled { opacity: 0.6; cursor: default; }
        .d-btn-ghost { background: transparent; color: var(--ink-soft); }
        .d-btn-ghost:hover { color: var(--ink); }
        .d-btn-danger { background: transparent; color: var(--danger); }
        .d-btn-danger:hover { text-decoration: underline; }
        .d-admin-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 12px; }
        .d-admin-sub { color: var(--ink-soft); font-size: 14px; margin: 0 0 30px; }
        .d-admin-actions { display: flex; gap: 14px; align-items: center; }
        .d-admin-row { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 0; border-top: 1px solid var(--line); }
        .d-admin-row:last-child { border-bottom: 1px solid var(--line); }
        .d-admin-row-title { font-weight: 600; font-size: 16px; margin: 0 0 4px; }
        .d-admin-row-meta { font-size: 13px; color: var(--ink-faint); }
        .d-admin-row-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .d-icon-btn { border: none; background: none; padding: 6px; border-radius: 4px; color: var(--ink-soft); cursor: pointer; display: inline-flex; }
        .d-icon-btn:hover { color: var(--accent); background: var(--surface); }
        .d-icon-btn.danger:hover { color: var(--danger); background: var(--surface); }
        .d-confirm { display: flex; align-items: center; gap: 10px; font-size: 13px; }
        .d-panel { background: var(--surface); border: 1px solid var(--line); border-radius: 6px; padding: 28px; margin-top: 20px; }
        .d-panel h3 { margin: 0 0 20px; font-size: 18px; }
        .d-form-actions { display: flex; gap: 10px; margin-top: 4px; }
        @media (max-width: 560px) {
          .d-shell { padding: 0 18px; }
          .d-header { padding: 28px 0 16px; }
          .d-panel { padding: 20px; }
          .d-admin-row { flex-direction: column; align-items: flex-start; }
          .d-admin-row-actions { align-self: flex-end; }
        }
      `}</style>

      <div className="d-shell">
        <header className="d-header">
          <div className="d-header-row">
            <button className="d-mast" onClick={goHome}>Dispatch</button>
            <span className="d-dateline">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <hr className="d-rule" />
        </header>

        <main className="d-main">
          {saveError && <div className="d-banner">{saveError}</div>}
          {loading && <p style={{ color: 'var(--ink-soft)' }}>Loading articles…</p>}
          {!loading && loadError && <div className="d-banner">{loadError}</div>}

          {!loading && !loadError && view === 'home' && (
            <>
              {sorted.length === 0 && (
                <div className="d-empty">Nothing published yet. Head to Admin, in the footer, to write the first post.</div>
              )}
              {sorted.length > 0 && (
                <div className="d-hero">
                  <div className="d-hero-cat">{sorted[0].category}</div>
                  <h1 className="d-hero-title" onClick={() => openArticle(sorted[0].id)}>{sorted[0].title}</h1>
                  <p className="d-hero-excerpt">{sorted[0].excerpt}</p>
                  <div className="d-hero-date">{formatDate(sorted[0].date)}</div>
                </div>
              )}
              {sorted.length > 1 && (
                <div className="d-list">
                  {sorted.slice(1).map((a) => (
                    <article key={a.id} className="d-row" onClick={() => openArticle(a.id)}>
                      <div className="d-row-cat">{a.category}</div>
                      <h2 className="d-row-title">{a.title}</h2>
                      <p className="d-row-excerpt">{a.excerpt}</p>
                      <div className="d-row-date">{formatDate(a.date)}</div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {!loading && !loadError && view === 'article' && active && (
            <div>
              <button className="d-back" onClick={goHome}><ArrowLeft size={15} /> All articles</button>
              <div className="d-article-cat">{active.category}</div>
              <h1 className="d-article-title">{active.title}</h1>
              <div className="d-article-date">{formatDate(active.date)}</div>
              <div className="d-article-body">
                {active.content.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </div>
          )}

          {!loading && !loadError && view === 'admin' && authChecked && !session && (
            <div className="d-login">
              <Lock className="d-login-icon" />
              <h2>Admin</h2>
              <p>Sign in with the account you created in Supabase.</p>
              <form onSubmit={handleLogin}>
                <div className="d-field">
                  <label htmlFor="email">Email</label>
                  <input id="email" type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} autoFocus />
                </div>
                <div className="d-field">
                  <label htmlFor="pw">Password</label>
                  <input id="pw" type="password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
                </div>
                {loginError && <div className="d-error">{loginError}</div>}
                <button className="d-btn d-btn-primary" type="submit" disabled={loggingIn} style={{ width: '100%', justifyContent: 'center' }}>
                  {loggingIn ? 'Signing in…' : 'Sign in'}
                </button>
              </form>
            </div>
          )}

          {!loading && !loadError && view === 'admin' && session && (
            <div>
              <div className="d-admin-head">
                <div>
                  <h2 style={{ margin: '0 0 4px', fontSize: 22, fontFamily: "'Fraunces', Georgia, serif" }}>Admin</h2>
                  <p className="d-admin-sub" style={{ margin: 0 }}>{articles.length} {articles.length === 1 ? 'post' : 'posts'} published</p>
                </div>
                <div className="d-admin-actions">
                  <button className="d-btn d-btn-ghost" onClick={goHome}>View site</button>
                  <button className="d-btn d-btn-ghost" onClick={handleLogout}><LogOut size={15} /> Log out</button>
                  <button className="d-btn d-btn-primary" onClick={openNewForm}><Plus size={15} /> New post</button>
                </div>
              </div>

              {editingId && (
                <div className="d-panel">
                  <h3>{editingId === 'new' ? 'Write a new post' : 'Edit post'}</h3>
                  <form onSubmit={handleSave}>
                    <div className="d-field">
                      <label htmlFor="f-title">Title</label>
                      <input id="f-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div className="d-field">
                      <label htmlFor="f-cat">Category</label>
                      <input id="f-cat" list="d-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="General" />
                      <datalist id="d-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
                    </div>
                    <div className="d-field">
                      <label htmlFor="f-date">Date</label>
                      <input id="f-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                    </div>
                    <div className="d-field">
                      <label htmlFor="f-excerpt">Excerpt (optional — shown in the list)</label>
                      <textarea id="f-excerpt" rows={2} value={form.excerpt} onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
                    </div>
                    <div className="d-field">
                      <label htmlFor="f-content">Content</label>
                      <textarea id="f-content" rows={10} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Separate paragraphs with a blank line." />
                    </div>
                    {formError && <div className="d-error">{formError}</div>}
                    <div className="d-form-actions">
                      <button className="d-btn d-btn-primary" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Publish'}</button>
                      <button className="d-btn d-btn-ghost" type="button" onClick={cancelForm}>Cancel</button>
                    </div>
                  </form>
                </div>
              )}

              {!editingId && (
                <div style={{ marginTop: 20 }}>
                  {sorted.length === 0 && <div className="d-empty">No posts yet — start with "New post" above.</div>}
                  {sorted.map((a) => (
                    <div className="d-admin-row" key={a.id}>
                      <div>
                        <p className="d-admin-row-title">{a.title}</p>
                        <p className="d-admin-row-meta">{a.category} · {formatDate(a.date)}</p>
                      </div>
                      {pendingDelete === a.id ? (
                        <div className="d-confirm">
                          <span>Delete this post?</span>
                          <button className="d-btn d-btn-danger" onClick={() => handleDelete(a.id)}>Yes, delete</button>
                          <button className="d-btn d-btn-ghost" onClick={() => setPendingDelete(null)}>Cancel</button>
                        </div>
                      ) : (
                        <div className="d-admin-row-actions">
                          <button className="d-icon-btn" onClick={() => openEditForm(a)} aria-label="Edit post"><Pencil size={16} /></button>
                          <button className="d-icon-btn danger" onClick={() => setPendingDelete(a.id)} aria-label="Delete post"><Trash2 size={16} /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="d-footer">
          <div className="d-footer-row">
            <span>Dispatch — a small publication</span>
            {view === 'admin' ? (
              <button className="d-link-btn" onClick={goHome}>View site</button>
            ) : (
              <button className="d-link-btn" onClick={openAdmin}>Admin</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

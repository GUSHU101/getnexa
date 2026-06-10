import { h, api, AdSlot, state, route } from '../core.js';

const CATEGORIES = [
  { key: '', label: 'All Posts', emoji: '📰' },
  { key: 'guides', label: 'Guides', emoji: '📖' },
  { key: 'lists', label: 'Top Lists', emoji: '🏆' },
  { key: 'competitive', label: 'Competitive', emoji: '⚔️' },
  { key: 'tips', label: 'Tips & Tricks', emoji: '💡' },
  { key: 'industry', label: 'Gaming News', emoji: '🌐' },
  { key: 'wellness', label: 'Gaming & You', emoji: '🧠' },
];

function BlogCard(post) {
  const date = new Date(post.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const cat = CATEGORIES.find(c => c.key === post.category) || CATEGORIES[0];
  return h('article', {
    class: 'blog-card',
    role: 'link', tabIndex: 0,
    onClick: () => route('/blog/' + post.slug),
    onKeydown: (e) => { if (e.key === 'Enter') route('/blog/' + post.slug); }
  },
    h('div', { class: 'blog-card-emoji' }, post.image_emoji || '🎮'),
    h('div', { class: 'blog-card-body' },
      h('div', { class: 'blog-card-meta' },
        h('span', { class: 'blog-cat-badge' }, cat.emoji + ' ' + (post.category || 'gaming')),
        h('span', { class: 'blog-card-date' }, date),
        h('span', { class: 'blog-card-time' }, post.read_time + ' min read')
      ),
      h('h2', { class: 'blog-card-title' }, post.title),
      h('p', { class: 'blog-card-excerpt' }, post.excerpt),
      h('div', { class: 'blog-card-cta' }, 'Read Article →')
    )
  );
}

export function BlogPage({ query }) {
  let currentCat = query?.get('cat') || '';
  let offset = 0;
  const limit = 9;
  let totalPosts = 0;

  const grid = h('div', { class: 'blog-grid', id: 'blog-grid' });
  const pag = h('div', { class: 'blog-pagination', id: 'blog-pag' });
  const countEl = h('span', { class: 'blog-count' }, '');

  const catPills = h('div', { class: 'cat-pills' },
    ...CATEGORIES.map(cat =>
      h('button', {
        class: 'cat-pill' + (currentCat === cat.key ? ' active' : ''),
        onClick: (e) => {
          catPills.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
          e.target.classList.add('active');
          currentCat = cat.key;
          offset = 0;
          load();
        }
      }, cat.emoji + ' ' + cat.label)
    )
  );

  function load() {
    grid.innerHTML = '<div class="blog-loading">Loading posts…</div>';
    const params = new URLSearchParams({ limit, offset });
    if (currentCat) params.set('category', currentCat);
    api('/api/blog?' + params).then(({ posts, total }) => {
      totalPosts = total;
      grid.innerHTML = '';
      if (!posts.length) {
        grid.appendChild(h('div', { class: 'blog-empty' }, '✍️ New posts are auto-generated every 8 hours. Check back soon!'));
        return;
      }
      posts.forEach(p => grid.appendChild(BlogCard(p)));
      countEl.textContent = total + ' articles';
      renderPagination();
    }).catch(() => {
      grid.innerHTML = '<div class="blog-empty">Unable to load posts — try refreshing.</div>';
    });
  }

  function renderPagination() {
    pag.innerHTML = '';
    const totalPages = Math.ceil(totalPosts / limit);
    const currentPage = Math.floor(offset / limit) + 1;
    if (totalPages <= 1) return;
    if (currentPage > 1) pag.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { offset -= limit; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, '← Prev'));
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
      const pg = i;
      pag.appendChild(h('button', { class: 'btn btn-sm' + (pg === currentPage ? ' btn-primary' : ''), onClick: () => { offset = (pg - 1) * limit; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, String(pg)));
    }
    if (currentPage < totalPages) pag.appendChild(h('button', { class: 'btn btn-sm', onClick: () => { offset += limit; load(); window.scrollTo({ top: 0, behavior: 'smooth' }); } }, 'Next →'));
  }

  load();

  return h('div', { class: 'page-blog' },
    h('div', { class: 'blog-hero' },
      h('div', { class: 'container' },
        h('div', { class: 'section-eyebrow' }, '📰 NEXA BLOG'),
        h('h1', { class: 'blog-hero-title' }, 'Gaming Guides & News'),
        h('p', { class: 'blog-hero-sub' }, 'Strategy guides, tips, and gaming insights — updated every 8 hours automatically.')
      )
    ),
    h('div', { class: 'container section-sm' },
      AdSlot('inArticle'),
      h('div', { class: 'section-head-row', style: 'margin-bottom: 32px;' },
        catPills,
        countEl
      ),
      grid,
      pag
    )
  );
}

export function BlogArticlePage({ params }) {
  const slug = params?.slug;
  if (!slug) { route('/blog'); return h('div', {}); }

  const wrap = h('div', { class: 'container section-sm blog-article-wrap' },
    h('div', { class: 'blog-loading' }, 'Loading article…')
  );

  api('/api/blog/' + slug).then(({ post }) => {
    if (!post) { wrap.innerHTML = '<div class="blog-empty">Article not found.</div>'; return; }
    const date = new Date(post.published_at).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const tags = (() => { try { return JSON.parse(post.tags); } catch { return []; } })();

    document.title = post.title + ' | NEXA Arcade Blog';
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute('content', post.meta_description);

    const ldJson = document.createElement('script');
    ldJson.type = 'application/ld+json';
    ldJson.textContent = JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Article',
      headline: post.title, description: post.meta_description,
      author: { '@type': 'Organization', name: 'NEXA Arcade' },
      publisher: { '@type': 'Organization', name: 'NEXA Arcade', url: 'https://getnexa.space' },
      datePublished: new Date(post.published_at).toISOString(),
      url: 'https://getnexa.space/blog/' + post.slug,
      image: 'https://getnexa.space/og.svg',
      mainEntityOfPage: { '@type': 'WebPage', '@id': 'https://getnexa.space/blog/' + post.slug }
    });
    document.head.appendChild(ldJson);

    wrap.innerHTML = '';
    wrap.appendChild(
      h('div', { class: 'blog-article' },
        h('div', { class: 'blog-article-back' },
          h('a', { href: '/blog', 'data-link': true, class: 'btn btn-sm' }, '← Back to Blog')
        ),
        h('header', { class: 'blog-article-header' },
          h('div', { class: 'blog-article-emoji' }, post.image_emoji || '🎮'),
          h('div', { class: 'blog-card-meta' },
            h('span', { class: 'blog-cat-badge' }, post.category),
            h('span', { class: 'blog-card-date' }, date),
            h('span', { class: 'blog-card-time' }, post.read_time + ' min read')
          ),
          h('h1', { class: 'blog-article-title' }, post.title),
          h('p', { class: 'blog-article-excerpt' }, post.excerpt),
          tags.length ? h('div', { class: 'blog-tags' }, ...tags.slice(0,8).map(t => h('span', { class: 'blog-tag' }, '#' + t.trim()))) : null
        ),
        AdSlot('inArticle'),
        h('div', { class: 'blog-article-content', innerHTML: post.content }),
        h('div', { class: 'blog-article-footer' },
          h('div', { class: 'panel', style: 'text-align:center; padding: 32px;' },
            h('h3', { style: 'margin-bottom:12px;' }, '🎮 Ready to Play?'),
            h('p', { style: 'color:var(--text-dim); margin-bottom:20px;' }, 'Put these strategies to work with 50+ free games — no download required.'),
            h('a', { href: '/games', 'data-link': true, class: 'btn btn-primary btn-lg' }, 'Play Free Games →')
          )
        ),
        AdSlot('inArticle')
      )
    );
  }).catch(() => {
    wrap.innerHTML = '<div class="blog-empty">Failed to load article. <a href="/blog" data-link="true">Back to Blog</a></div>';
  });

  return h('div', { class: 'page-blog' },
    h('div', { class: 'blog-hero blog-hero-sm' },
      h('div', { class: 'container' },
        h('div', { class: 'section-eyebrow' }, '📰 NEXA BLOG')
      )
    ),
    wrap
  );
}

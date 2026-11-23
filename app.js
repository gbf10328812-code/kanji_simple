'use strict';
(() => {
  const $ = (id) => document.getElementById(id);
  const results = $('results'), q = $('q'), detail = $('detail'), detailBody = $('detailBody');
  let K = null, W = null, kIndex = null, ready = null;

  // ---- helpers ----
  const toHira = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  const norm = (s) => toHira((s || '').normalize('NFKC')).replace(/[\s　]/g, '');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const isKanji = (c) => /[㐀-鿿豈-﫿\u{20000}-\u{3134f}々]/u.test(c);

  // 常用・人名用を先に、新聞での使用頻度が高い順に
  const rank = (c) => {
    const k = K[c];
    let r = k.f ? k.f : 5000;
    if (k.g == null) r += 20000; else if (k.g >= 9) r += 8000;
    return r;
  };
  const isCommon = (c) => K[c].g != null;

  function load() {
    if (ready) return ready;
    results.innerHTML = '<div class="loading">じゅんび中です…</div>';
    ready = Promise.all([
      fetch('data/kanji.json').then((r) => r.json()),
      fetch('data/words.json').then((r) => r.json()),
    ]).then(([k, w]) => {
      K = k; W = w; kIndex = new Map();
      const add = (key, c) => {
        if (!key) return;
        let s = kIndex.get(key);
        if (!s) kIndex.set(key, (s = new Set()));
        s.add(c);
      };
      for (const c in K) {
        const e = K[c];
        for (const r of e.on) add(toHira(r.replace(/-/g, '')), c);
        for (const r of e.kun) {
          const clean = r.replace(/-/g, '');
          add(clean.replace('.', ''), c); // いく
          add(clean.split('.')[0], c);    // い
        }
      }
      results.innerHTML = '<div class="hint">例：「やま」「がっこう」「はし」と入れて「しらべる」を押します。</div>';
    }).catch((e) => {
      ready = null;
      results.innerHTML = '<div class="empty">データを読みこめませんでした。インターネットにつないで、もう一度ひらいてください。</div>';
      throw e;
    });
    return ready;
  }

  // ---- search ----
  async function search() {
    const s = norm(q.value);
    if (!s) { results.innerHTML = ''; return; }
    await load();
    let html = '';

    // ことば（読みがぴったり）
    const words = W[s] || [];
    if (words.length) {
      html += `<h2>「${esc(s)}」と読むことば</h2><div class="words">`;
      for (const [w, common] of words.slice(0, 40))
        html += `<button class="word${common ? '' : ' rare'}" data-w="${esc(w)}" data-y="${esc(s)}">${esc(w)}</button>`;
      html += '</div>';
    }

    // 漢字一字
    const ks = [...(kIndex.get(s) || [])].sort((a, b) => rank(a) - rank(b));
    if (ks.length) {
      const common = ks.filter(isCommon), rare = ks.filter((c) => !isCommon(c));
      html += `<h2>「${esc(s)}」と読む漢字</h2>`;
      if (common.length) html += '<div class="grid">' + common.map(tile).join('') + '</div>';
      if (rare.length) {
        html += `<button class="btn ghost more" id="moreBtn">むずかしい漢字も見る（${rare.length}）</button>`;
        html += `<div class="grid" id="rareGrid" style="display:none;margin-top:10px">${rare.map(tile).join('')}</div>`;
      }
    }

    // ぴったりが無いときは「〜ではじまる」ことば
    if (!words.length && !ks.length) {
      const pre = [];
      if (s.length >= 2) {
        for (const y in W) {
          if (y.startsWith(s)) for (const [w, c] of W[y]) if (c) pre.push([w, y]);
          if (pre.length > 60) break;
        }
      }
      if (pre.length) {
        html += `<h2>「${esc(s)}」ではじまることば</h2><ul class="ex">`;
        for (const [w, y] of pre.slice(0, 40))
          html += `<li><button class="word" data-w="${esc(w)}" data-y="${esc(y)}">${esc(w)}</button><span class="y">${esc(y)}</span></li>`;
        html += '</ul>';
      } else {
        html = `<div class="empty">「${esc(s)}」は見つかりませんでした。<br>ひらがなで、もう一度入れてみてください。</div>`;
      }
    }
    results.innerHTML = html;
    const more = $('moreBtn');
    if (more) more.onclick = () => { $('rareGrid').style.display = ''; more.remove(); };
  }
  const tile = (c) => `<button class="k" data-k="${esc(c)}" aria-label="${esc(c)}"><span>${esc(c)}</span></button>`;

  // ---- detail ----
  const kunHtml = (r) => {
    const clean = r.replace(/-/g, '');
    const [stem, ok] = clean.split('.');
    return `<span class="r">${esc(stem)}${ok ? `<span class="okuri">${esc(ok)}</span>` : ''}</span>`;
  };
  const gradeLabel = (g) => g == null ? '' : g <= 6 ? `<span class="tag">小学${g}年でならう</span>` :
    g === 8 ? '<span class="tag">常用漢字</span>' : '<span class="tag">名前に使う漢字</span>';

  function showKanji(c) {
    const e = K[c]; if (!e) return;
    let h = `<div class="big">${esc(c)}</div><dl>`;
    if (e.on.length) h += `<dt>音読み</dt><dd>${e.on.map((r) => `<span class="r">${esc(r)}</span>`).join('')}</dd>`;
    if (e.kun.length) h += `<dt>訓読み</dt><dd>${e.kun.map(kunHtml).join('')}</dd>`;
    if (e.st) h += `<dt>画数</dt><dd>${e.st}画</dd>`;
    if (e.g != null) h += `<dt></dt><dd>${gradeLabel(e.g)}</dd>`;
    h += '</dl>';
    if (e.ex.length) {
      h += '<h2>この漢字をつかうことば</h2><ul class="ex">';
      for (const [w, y] of e.ex) h += `<li><span class="w">${esc(w)}</span><span class="y">${esc(y)}</span></li>`;
      h += '</ul>';
    }
    openDetail(h);
  }

  function showWord(w, y) {
    let h = `<div class="big wordbig">${esc(w)}</div><div class="yomi">${esc(y)}</div>`;
    const chars = [...w].filter((c) => isKanji(c) && K && K[c]);
    if (chars.length) {
      h += '<h2>ひとつずつ見る</h2><div class="grid">' + [...new Set(chars)].map(tile).join('') + '</div>';
    }
    openDetail(h);
  }

  function openDetail(h) {
    detailBody.innerHTML = h;
    detail.classList.add('open');
    detail.scrollTop = 0;
    history.pushState({ d: 1 }, '');
  }
  function closeDetail() { detail.classList.remove('open'); }
  window.addEventListener('popstate', () => {
    // 詳細を重ねて開いている場合は1つ前に戻る代わりに閉じる
    closeDetail();
  });
  $('backBtn').onclick = () => { if (history.state && history.state.d) history.back(); else closeDetail(); };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-k], button[data-w]');
    if (!b) return;
    if (b.dataset.k) showKanji(b.dataset.k);
    else showWord(b.dataset.w, b.dataset.y);
  });

  // ---- input ----
  $('form').addEventListener('submit', (ev) => { ev.preventDefault(); q.blur(); search(); });
  $('clear').onclick = () => { q.value = ''; results.innerHTML = ''; q.focus(); };

  // ---- font size ----
  const sizes = [18, 22, 26, 30, 34];
  let si = 1;
  try { const v = +localStorage.getItem('fs'); if (sizes.includes(v)) si = sizes.indexOf(v); } catch (_) {}
  const applySize = () => {
    document.documentElement.style.setProperty('--fs', sizes[si] + 'px');
    try { localStorage.setItem('fs', sizes[si]); } catch (_) {}
  };
  applySize();
  $('bigger').onclick = () => { if (si < sizes.length - 1) { si++; applySize(); } };
  $('smaller').onclick = () => { if (si > 0) { si--; applySize(); } };

  // ---- install hint (Safari, not yet installed) ----
  const standalone = window.navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  let hidden = false;
  try { hidden = localStorage.getItem('installHint') === '0'; } catch (_) {}
  if (!standalone && !hidden && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document) {
    $('install').style.display = 'block';
  }
  $('installClose').onclick = () => {
    $('install').style.display = 'none';
    try { localStorage.setItem('installHint', '0'); } catch (_) {}
  };

  // ---- offline ----
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  load().catch(() => {});
})();

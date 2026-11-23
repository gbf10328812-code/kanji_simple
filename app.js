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
      results.innerHTML = '<div class="hint">例：「やま」「がっこう」「きょうはいいてんき」と入れて「しらべる」を押します。</div>';
    }).catch((e) => {
      ready = null;
      results.innerHTML = '<div class="empty">データを読みこめませんでした。インターネットにつないで、もう一度ひらいてください。</div>';
      throw e;
    });
    return ready;
  }

  // ---- 変換（活用形・文） ----
  const A = 'あいうえお', ROWS = {k:'かきくけこ',g:'がぎぐげご',s:'さしすせそ',t:'たちつてと',n:'なにぬねの',b:'ばびぶべぼ',m:'まみむめも',r:'らりるれろ',w:'わいうえお'};
  const RULES = [];
  // 一段動詞（食べる）
  for (const suf of ['る','ます','ました','ません','ませんでした','ない','なかった','た','て','たい','たかった','れば','よう','ろ','られる','られた','させる','させた','ている','ていた','てる','ちゃう','ちゃった'])
    RULES.push([suf, 'る']);
  // 五段動詞（書く・読む…）
  const u = {k:'く',g:'ぐ',s:'す',t:'つ',n:'ぬ',b:'ぶ',m:'む',r:'る',w:'う'};
  for (const r in ROWS) {
    const row = ROWS[r], end = u[r];
    for (const x of ['ます','ました','ません','ませんでした','たい','たかった']) RULES.push([row[1] + x, end]);
    for (const x of ['ない','なかった','れる','れた','せる','せた']) RULES.push([row[0] + x, end]);
    RULES.push([row[3] + 'ば', end], [row[3] + 'る', end], [row[4] + 'う', end]);
  }
  for (const [te, ends] of [['っ', ['う','つ','る']], ['ん', ['む','ぬ','ぶ']]]) {
    for (const e of ends) {
      const d = te === 'ん' ? 'だ' : 'た', t = te === 'ん' ? 'で' : 'て';
      for (const x of [d, t, t + 'いる', t + 'いた', t + 'る', t + 'た', d + 'ろう']) RULES.push([te + x, e]);
    }
  }
  for (const x of ['た','て','ている','ていた','てる']) { RULES.push(['い' + x, 'く']); RULES.push(['し' + x, 'す']); }
  for (const x of ['だ','で','でいる','でいた']) RULES.push(['い' + x, 'ぐ']);
  // 形容詞（高い）
  for (const x of ['かった','くて','くない','くなかった','ければ','く','さ','そう']) RULES.push([x, 'い']);

  // 読み s に合う [書き, よく使うか] の候補
  function lookup(s) {
    const out = [], seen = new Set();
    (W[s] || []).forEach(([w, c], ix) => { seen.add(w); out.push([w, c, 0, ix]); });
    for (const [suf, rep] of RULES) {
      if (s.length <= suf.length || !s.endsWith(suf)) continue;
      const base = s.slice(0, -suf.length) + rep;
      for (const [w, c] of (W[base] || [])) {
        if (!w.endsWith(rep)) continue;
        const f = w.slice(0, -rep.length) + suf;
        if (!isKanji(f[0]) && f.length < 2) continue;
        if (!seen.has(f)) { seen.add(f); out.push([f, c, 1, 0]); }
      }
    }
    const kr = (w) => { let t = 0, n = 0; for (const ch of w) if (K[ch]) { t += rank(ch); n++; } return n ? t / n : 99999; };
    for (const o of out) if (o[2]) o[3] = kr(o[0]);
    out.sort((a, b) => (b[1] - a[1]) || (a[2] - b[2]) || (a[3] - b[3]));
    return out;
  }

  const PARTICLES = 'はがをにでともへのやかねよな';
  // ふつう ひらがなで書くことば
  const KANA = new Set(('いい よい です でした でしょう ます ました ません ある あります あった いる います いた する します した しない して ない なかった なる なります なった こと もの とき ところ ため よう これ それ あれ どれ この その あの どの ここ そこ あそこ どこ だれ なに なん いつ どう こう そう ああ とても もっと ちょっと すこし まだ もう また よく ありがとう おはよう こんにちは こんばんは さようなら ください くださる いただく いただきます ごちそうさま ね よ か な だ だった から まで より けど けれど でも しかし そして それから だから ので のに ぐらい くらい ばかり だけ しか など みたい らしい ちゃん さん くん').split(' '));
  // 文をことばに区切って変換（できるだけ長く、よく使うことばを優先）
  function convert(s) {
    const n = s.length, best = new Array(n + 1).fill(null);
    best[0] = { cost: 0, segs: [] };
    for (let i = 0; i < n; i++) {
      if (!best[i]) continue;
      // ひらがなのまま（助詞は安く）
      const kc = best[i].cost + (PARTICLES.includes(s[i]) ? 0.8 : 1.2);
      if (!best[i + 1] || kc < best[i + 1].cost) best[i + 1] = { cost: kc, segs: best[i].segs.concat([{ y: s[i], c: null }]) };
      for (let j = i + 1; j <= Math.min(n, i + 14); j++) {
        const y = s.slice(i, j);
        if (KANA.has(y)) {
          const c2 = best[i].cost + 1;
          if (!best[j] || c2 < best[j].cost) best[j] = { cost: c2, segs: best[i].segs.concat([{ y, c: null }]) };
        }
        const cand = lookup(y);
        if (!cand.length) continue;
        const len = j - i;
        const cost = best[i].cost + 1 + (len === 1 ? 2.5 : 0) + (cand[0][1] ? 0 : 2);
        if (!best[j] || cost < best[j].cost) best[j] = { cost, segs: best[i].segs.concat([{ y, c: cand }]) };
      }
    }
    // ひらがなのままの部分はまとめる
    const segs = [];
    for (const g of best[n].segs) {
      const last = segs[segs.length - 1];
      if (!g.c && last && !last.c) last.y += g.y; else segs.push({ ...g });
    }
    return segs;
  }

  // 変換結果の表示（box: {segs, title, id, max}）
  const boxes = {};
  function renderBox(b) {
    const text = b.segs.map((g) => g.c ? g.c[g.i][0] : g.y).join('');
    let h = `<h2>${b.title}</h2><div class="big wordbig conv">${esc(text)}</div>`;
    const multi = b.segs.filter((g) => g.c && g.c.length > 1);
    if (multi.length) {
      h += '<div class="hint">ちがうときは、下からえらんでください。</div>';
      b.segs.forEach((g, gi) => {
        if (!g.c || g.c.length < 2) return;
        const max = g.open ? g.c.length : b.max;
        h += `<div class="seg"><div class="segy">${esc(g.label || g.y)}</div><div class="words">`;
        g.c.slice(0, max).forEach(([w], ci) => {
          h += `<button class="word${ci === g.i ? ' sel' : ''}" data-b="${b.id}" data-g="${gi}" data-c="${ci}">${esc(w)}</button>`;
        });
        if (g.c.length > max) h += `<button class="word" data-b="${b.id}" data-g="${gi}" data-more="1">ほかの字（${g.c.length - max}）</button>`;
        h += '</div></div>';
      });
    }
    return h;
  }
  function boxHtml(b) { boxes[b.id] = b; return `<div id="${b.id}">${renderBox(b)}</div>`; }

  // ---- 人名 ----
  let N = null, namesReady = null;
  const loadNames = () => namesReady || (namesReady = fetch('data/names.json').then((r) => r.json()).then((n) => { N = n; })
    .catch((e) => { namesReady = null; throw e; }));
  const nameCands = (y, t) => (N[y] || []).filter(([, f]) => !t || f.includes(t) || !f).map(([w]) => [w, 1]);

  function nameBox(s) {
    // 名字だけ・名前だけ
    if (N[s]) return { id: 'nameBox', title: '人の名前なら', max: 24, segs: [{ y: s, c: nameCands(s), i: 0 }] };
    // 名字＋名前
    const splits = [];
    for (let i = 2; i <= s.length - 1; i++) {
      const a = nameCands(s.slice(0, i), 's'), b = nameCands(s.slice(i), 'g');
      if (a.length && b.length) splits.push([i, Math.min(a.length, 30) + Math.min(b.length, 30)]);
    }
    if (!splits.length) return null;
    splits.sort((x, y) => y[1] - x[1]);
    const i = splits[0][0];
    return { id: 'nameBox', title: '人の名前なら', max: 24, segs: [
      { y: s.slice(0, i), label: '名字：' + s.slice(0, i), c: nameCands(s.slice(0, i), 's'), i: 0 },
      { y: '　', c: null },
      { y: s.slice(i), label: '名前：' + s.slice(i), c: nameCands(s.slice(i), 'g'), i: 0 },
    ] };
  }

  // ---- search ----
  async function search() {
    const s = norm(q.value);
    if (!s) { results.innerHTML = ''; return; }
    await load();
    let html = '';

    // 文や活用形の変換（ぴったりのことばが無いとき）
    let conv = false, convFrag = false;
    if (!W[s] && s.length <= 40) {
      const segs = convert(s);
      if (segs.some((g) => g.c)) {
        conv = true;
        convFrag = segs.length >= 2 && s.length <= 8;
        html += boxHtml({ id: 'convBox', title: '変換すると', max: 12, segs: segs.map((g) => ({ ...g, i: 0 })) });
      }
    }
    // 人の名前（短くて文になりにくいときは先に出す）
    let nb = null;
    if (s.length >= 2 && s.length <= 12) {
      try { await loadNames(); nb = nameBox(s); } catch (_) {}
    }
    if (nb && (convFrag || !conv) && !W[s]) html = boxHtml(nb) + html;

    // ことば（読みがぴったり）
    const words = W[s] || [];
    if (words.length) {
      html += `<h2>「${esc(s)}」と読むことば</h2><div class="words">`;
      for (const [w, common] of words.slice(0, 40))
        html += `<button class="word${common ? '' : ' rare'}" data-w="${esc(w)}" data-y="${esc(s)}">${esc(w)}</button>`;
      html += '</div>';
    }

    if (nb && !html.includes('id="nameBox"')) html += boxHtml(nb);

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
    if (!words.length && !ks.length && !conv && !nb) {
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
    const g = ev.target.closest('button[data-b]');
    if (g) {
      const bx = boxes[g.dataset.b], seg = bx.segs[+g.dataset.g];
      if (g.dataset.more) seg.open = true; else seg.i = +g.dataset.c;
      $(bx.id).innerHTML = renderBox(bx);
      return;
    }
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

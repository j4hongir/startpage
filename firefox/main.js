(() => {
  const K = { CFG: 'sp_cfg_v8', LINKS: 'sp_links_v4', BM_STATS: 'sp_bm_stats_v1' };

  const ENGINES = {
    google: 'https://www.google.com/search?q=',
    duckduckgo: 'https://duckduckgo.com/?q=',
    yandex: 'https://yandex.com/search/?text=',
    bing: 'https://www.bing.com/search?q=',
    brave: 'https://search.brave.com/search?q=',
    startpage: 'https://www.startpage.com/do/search?q='
  };

  const STRINGS = {
    en: {
      sLang:         'language',
      sTheme:        'theme',
      sEngine:       'search engine',
      sBlocks:       'blocks',
      sLinks:        'quick links',
      bSearch:       'search bar',
      bLinks:        'quick links',
      bIp:           'ip info',
      newName:       'name',
      addBtn:        'add',
      searchPh:      'search...',
      ipTitle:       'ip info',
      ipCheck:       'check',
      settingsLabel: 'settings',
    },
    ru: {
      sLang:         'язык',
      sTheme:        'тема',
      sEngine:       'поисковик',
      sBlocks:       'блоки',
      sLinks:        'быстрые ссылки',
      bSearch:       'строка поиска',
      bLinks:        'быстрые ссылки',
      bIp:           'ip info',
      newName:       'название',
      addBtn:        'добавить',
      searchPh:      'поиск...',
      ipTitle:       'ip info', 
      ipCheck:       'проверить',
      settingsLabel: 'настройки',
    }
  };

  const DEF = {
    theme: 'gruvbox-dark',
    engine: 'google',
    lang: 'en',
    blocks: { search: true, links: true, ip: true }
  };

  const DEF_LINKS = [
    { id: id(), n: 'github', u: 'https://github.com/jahamars', e: 1 },
    { id: id(), n: 'reddit', u: 'https://reddit.com', e: 1 },
    { id: id(), n: 'blog', u: 'https://jahongir.ru', e: 1 }
  ];

  const s = hydrate();
  const el = {};

  let ipInited = false;
  let allBookmarks = [];
  let dropResults = [];
  let dropIdx = -1;
  let explicitSelection = false;
  let searchTimer = null;
  let bmStats = parse(localStorage.getItem(K.BM_STATS)) || {};

  document.addEventListener('DOMContentLoaded', () => {
    mapEls();
    buildDrop();
    bind();
    renderAll();
    loadBookmarks();
    if (s.blocks.ip) initIp();
    focusSearch();
  });

  function mapEls() {
    el.btn = document.getElementById('settings-btn');
    el.panel = document.getElementById('settings-panel');
    el.searchBlock = document.getElementById('search-block');
    el.searchInput = document.getElementById('search-input');
    el.linksBlock = document.getElementById('links-block');
    el.linksList = document.getElementById('links-list');
    el.ipBlock = document.getElementById('ip-block');
    el.editorList = document.getElementById('editor-list');
    el.newName = document.getElementById('new-name');
    el.newUrl = document.getElementById('new-url');
    el.addBtn = document.getElementById('add-link');
  }

  function buildDrop() {
    const drop = document.createElement('ul');
    drop.id = 'bm-drop';
    drop.className = 'hidden';
    drop.setAttribute('role', 'listbox');
    el.searchBlock.appendChild(drop);
    el.drop = drop;
  }

  function bind() {
    el.btn.addEventListener('click', () => {
      el.panel.classList.toggle('hidden');
    });

    document.addEventListener('pointerdown', (e) => {
      if (el.panel.classList.contains('hidden')) return;
      const t = e.target;
      if (el.panel.contains(t) || el.btn.contains(t)) return;
      el.panel.classList.add('hidden');
    });

    el.panel.addEventListener('change', onPanelChange);
    el.panel.addEventListener('click', onPanelClick);

    el.searchInput.addEventListener('input', () => {
      dropIdx = -1;
      explicitSelection = false;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => renderDrop(el.searchInput.value), 45);
    });

    el.searchInput.addEventListener('keydown', (e) => {
      const open = !el.drop.classList.contains('hidden');
      const hasResults = dropResults.length > 0;

      switch (e.key) {
        case 'ArrowDown':
          if (!hasResults) return;
          e.preventDefault();
          selectByDelta(1);
          return;

        case 'ArrowUp':
          if (!hasResults) return;
          e.preventDefault();
          selectByDelta(-1);
          return;

        case 'Tab':
          if (!hasResults) return;
          e.preventDefault();
          selectWithTab(e.shiftKey);
          return;

        case 'Escape':
          e.preventDefault();
          if (open) closeDrop();
          else {
            el.searchInput.value = '';
            el.searchInput.blur();
          }
          return;

        case 'Enter':
          e.preventDefault();
          if (explicitSelection && dropIdx >= 0 && dropResults[dropIdx]) {
            navigate(dropResults[dropIdx].u);
          } else {
            runWebSearch(el.searchInput.value);
          }
          return;
      }
    });

    document.addEventListener('keydown', (e) => {
      const t = e.target;
      const typing = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t?.isContentEditable;

      if (typing) return;

      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        el.panel.classList.toggle('hidden');
        return;
      }

      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (!s.blocks.ip) return;
        if (!ipInited) initIp();
        if (el.ipCheckBtn && !el.ipCheckBtn.disabled) el.ipCheckBtn.click();
        return;
      }

      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        focusSearch();
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (!el.searchBlock.contains(e.target)) closeDrop();
    });

    el.addBtn.addEventListener('click', addLink);
    el.newUrl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') addLink();
    });
  }

  function onPanelChange(e) {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;

    if (t.name === 'theme') s.theme = t.value;
    else if (t.name === 'engine') s.engine = t.value;
    else if (t.name === 'lang') s.lang = t.value;
    else if (t.dataset.block) s.blocks[t.dataset.block] = t.checked;
    else if (t.dataset.eid) updateLinkField(t);

    persist();
    renderAll();

    if (s.blocks.ip && !ipInited) initIp();
  }

  function onPanelClick(e) {
    const btn = e.target.closest('button[data-del]');
    if (!btn) return;

    s.links = s.links.filter(x => x.id !== btn.dataset.del);
    persist();
    renderLinks();
    renderEditor();
  }

  function addLink() {
    const n = el.newName.value.trim() || 'link';
    const u = normalizeUrl(el.newUrl.value.trim());
    if (!u) return;

    s.links.push({ id: id(), n, u, e: 1 });
    el.newName.value = '';
    el.newUrl.value = '';
    persist();
    renderLinks();
    renderEditor();
  }

  function updateLinkField(input) {
    const item = s.links.find(x => x.id === input.dataset.eid);
    if (!item) return;

    const f = input.dataset.f;
    if (f === 'e') item.e = input.checked ? 1 : 0;
    if (f === 'n') item.n = input.value.trim() || 'link';
    if (f === 'u') {
      const u = normalizeUrl(input.value.trim());
      if (u) item.u = u;
      input.value = item.u;
    }
  }

  function renderAll() {
    document.documentElement.dataset.theme = s.theme;
    syncControls();
    applyLang();
    applyBlocks();
    renderLinks();
    renderEditor();
  }

  function syncControls() {
    setChecked(`input[name="theme"][value="${s.theme}"]`, true);
    setChecked(`input[name="engine"][value="${s.engine}"]`, true);
    setChecked(`input[name="lang"][value="${s.lang}"]`, true);
    setChecked('input[data-block="search"]', !!s.blocks.search);
    setChecked('input[data-block="links"]', !!s.blocks.links);
    setChecked('input[data-block="ip"]', !!s.blocks.ip);
  }

  function applyLang() {
    const t = STRINGS[s.lang] || STRINGS.en;

    document.documentElement.lang = s.lang;

    document.querySelectorAll('[data-i18n]').forEach(node => {
      const key = node.dataset.i18n;
      if (t[key] !== undefined) node.textContent = t[key];
    });

    document.querySelectorAll('[data-i18n-ph]').forEach(node => {
      const key = node.dataset.i18nPh;
      if (t[key] !== undefined) node.placeholder = t[key];
    });

    document.querySelectorAll('[data-i18n-label]').forEach(node => {
      const key = node.dataset.i18nLabel;
      if (t[key] !== undefined) node.setAttribute('aria-label', t[key]);
    });
  }

  function applyBlocks() {
    el.searchBlock.style.display = s.blocks.search ? '' : 'none';
    el.linksBlock.style.display = s.blocks.links ? '' : 'none';
    el.ipBlock.style.display = s.blocks.ip ? '' : 'none';
  }

  function renderLinks() {
    const arr = s.links.filter(x => x.e);
    if (!s.blocks.links || !arr.length) {
      el.linksBlock.style.display = 'none';
      el.linksList.textContent = '';
      return;
    }

    const frag = document.createDocumentFragment();
    for (const x of arr) {
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = x.u;
      a.textContent = x.n;
      li.appendChild(a);
      frag.appendChild(li);
    }
    el.linksList.replaceChildren(frag);
  }

  function renderEditor() {
    const frag = document.createDocumentFragment();
    for (const x of s.links) {
      const row = document.createElement('div');
      row.className = 'e-row';

      const chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.dataset.eid = x.id;
      chk.dataset.f = 'e';
      chk.checked = !!x.e;

      const nameIn = document.createElement('input');
      nameIn.type = 'text';
      nameIn.dataset.eid = x.id;
      nameIn.dataset.f = 'n';
      nameIn.value = x.n;

      const urlIn = document.createElement('input');
      urlIn.type = 'text';
      urlIn.dataset.eid = x.id;
      urlIn.dataset.f = 'u';
      urlIn.value = x.u;

      const del = document.createElement('button');
      del.type = 'button';
      del.dataset.del = x.id;
      del.textContent = '✕';

      row.append(chk, nameIn, urlIn, del);
      frag.appendChild(row);
    }
    el.editorList.replaceChildren(frag);
  }

  function loadBookmarks() {
    if (!chrome?.bookmarks) return;
    chrome.bookmarks.getTree((tree) => {
      allBookmarks = [];
      flattenTree(tree);
    });
  }

  function flattenTree(nodes) {
    for (const node of nodes) {
      if (node.url) {
        const u = node.url;
        const n = (node.title || node.url).trim();
        let host = '';
        let path = '';

        try {
          const x = new URL(u);
          host = x.hostname.replace(/^www\./, '');
          path = x.pathname.replace(/\/+$/, '');
        } catch {}

        allBookmarks.push({
          n, u, host, path,
          _nl: n.toLowerCase(),
          _ul: u.toLowerCase(),
          _hl: host.toLowerCase(),
          _pl: path.toLowerCase()
        });
      }
      if (node.children) flattenTree(node.children);
    }
  }

  function renderDrop(query) {
    const q = query.trim();
    if (!q || !allBookmarks.length) return closeDrop();

    const variants = buildQueryVariants(q);
    const scored = [];

    for (const bm of allBookmarks) {
      const r = scoreBookmark(bm, variants);
      if (!r) continue;
      scored.push({ bm, ...r });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 8);
    dropResults = top.map(x => x.bm);
    dropIdx = -1;
    explicitSelection = false;

    if (!top.length) return closeDrop();

    const frag = document.createDocumentFragment();
    top.forEach(({ bm, titleRanges, urlRanges }, i) => {
      const li = document.createElement('li');
      li.className = 'bm-item';
      li.dataset.idx = String(i);
      li.id = `bm-opt-${i}`;
      li.setAttribute('role', 'option');

      const fav = document.createElement('img');
      fav.className = 'bm-fav';
      fav.decoding = 'async';
      fav.loading = 'lazy';
      fav.src = `https://www.google.com/s2/favicons?sz=16&domain_url=${encodeURIComponent(bm.u)}`;
      fav.onerror = () => { fav.style.visibility = 'hidden'; };

      const name = document.createElement('span');
      name.className = 'bm-name';
      name.replaceChildren(highlightRanges(bm.n, titleRanges));

      const url = document.createElement('span');
      url.className = 'bm-url';
      const shortUrl = bm.u.replace(/^https?:\/\//, '').replace(/\/$/, '');
      url.replaceChildren(highlightRanges(shortUrl, urlRanges));

      li.append(fav, name, url);

      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        navigate(bm.u);
      });

      li.addEventListener('mouseenter', () => {
        dropIdx = i;
        explicitSelection = false;
        updateDropActive();
      });

      frag.appendChild(li);
    });

    el.drop.replaceChildren(frag);
    el.drop.classList.remove('hidden');
    el.searchInput.setAttribute('aria-expanded', 'true');
    updateDropActive();
  }

  function closeDrop() {
    el.drop.classList.add('hidden');
    el.drop.replaceChildren();
    dropResults = [];
    dropIdx = -1;
    explicitSelection = false;
    el.searchInput.setAttribute('aria-expanded', 'false');
    el.searchInput.removeAttribute('aria-activedescendant');
  }

  function openDropIfNeeded() {
    if (dropResults.length) {
      el.drop.classList.remove('hidden');
      el.searchInput.setAttribute('aria-expanded', 'true');
    }
  }

  function updateDropActive() {
    const items = el.drop.querySelectorAll('.bm-item');
    items.forEach((item, i) => item.classList.toggle('bm-active', i === dropIdx));

    if (dropIdx >= 0) {
      el.searchInput.setAttribute('aria-activedescendant', `bm-opt-${dropIdx}`);
    } else {
      el.searchInput.removeAttribute('aria-activedescendant');
    }

    el.drop.querySelector('.bm-active')?.scrollIntoView({ block: 'nearest' });
  }

  function selectByDelta(delta) {
    const len = dropResults.length;
    if (!len) return;
    openDropIfNeeded();

    if (dropIdx < 0) dropIdx = delta > 0 ? 0 : len - 1;
    else dropIdx = (dropIdx + delta + len) % len;

    explicitSelection = true;
    updateDropActive();
  }

  function selectWithTab(shift) {
    const len = dropResults.length;
    if (!len) return;
    openDropIfNeeded();

    if (dropIdx < 0) dropIdx = shift ? len - 1 : 0;
    else dropIdx = (dropIdx + (shift ? -1 : 1) + len) % len;

    explicitSelection = true;
    updateDropActive();
  }

  function navigate(url) {
    const st = bmStats[url] || { hits: 0, last: 0 };
    st.hits += 1;
    st.last = Date.now();
    bmStats[url] = st;
    localStorage.setItem(K.BM_STATS, JSON.stringify(bmStats));

    closeDrop();
    el.searchInput.value = '';
    window.location.href = url;
  }

  function runWebSearch(query) {
    const q = query.trim();
    if (!q) return;
    closeDrop();
    el.searchInput.value = '';
    window.location.href = (ENGINES[s.engine] || ENGINES.google) + encodeURIComponent(q);
  }

  function scoreBookmark(bm, variants) {
    const fields = [
      { key: 'title', text: bm._nl, w: 1.25 },
      { key: 'host', text: bm._hl, w: 1.35 },
      { key: 'path', text: bm._pl, w: 1.00 },
      { key: 'url', text: bm._ul, w: 0.90 }
    ];

    let bestScore = -Infinity;
    let best = null;

    for (const q of variants) {
      const ql = q.toLowerCase();
      for (const f of fields) {
        const m = matchSmart(f.text, ql);
        if (!m) continue;

        const st = bmStats[bm.u] || { hits: 0, last: 0 };
        const hitsBoost = Math.min(4, st.hits * 0.35);
        const recencyBoost = st.last
          ? Math.max(0, 2 - (Date.now() - st.last) / (1000 * 60 * 60 * 24 * 7))
          : 0;

        const total = m.score * f.w + hitsBoost + recencyBoost;
        if (total > bestScore) {
          bestScore = total;
          best = {
            score: total,
            titleRanges: f.key === 'title' ? m.ranges : [],
            urlRanges: (f.key === 'url' || f.key === 'host' || f.key === 'path') ? m.ranges : []
          };
        }
      }
    }

    return bestScore > 0 ? best : null;
  }

  function matchSmart(t, q) {
    if (!t || !q) return null;

    const at = t.indexOf(q);
    if (at >= 0) {
      return {
        score: 14 + Math.min(8, q.length * 0.8) - at * 0.02,
        ranges: [[at, at + q.length]]
      };
    }

    const qt = q.split(/\s+/).filter(Boolean);
    if (qt.length > 1) {
      let ssum = 0;
      const ranges = [];
      for (const token of qt) {
        const i = t.indexOf(token);
        if (i < 0) return null;
        ssum += 5 + token.length * 0.5;
        ranges.push([i, i + token.length]);
      }
      return { score: ssum, ranges };
    }

    const fz = fuzzySubseq(t, q);
    if (fz) return fz;

    if (q.length >= 4 && q.length <= 14 && t.length <= 120) {
      const dist = editDistanceWindowed(t, q, 2);
      if (dist <= 2) return { score: 6 - dist * 1.5 + q.length * 0.25, ranges: [] };
    }

    return null;
  }

  function fuzzySubseq(t, q) {
    const idx = [];
    let i = 0;
    let j = 0;
    let score = 0;
    let streak = 0;

    while (i < t.length && j < q.length) {
      if (t[i] === q[j]) {
        idx.push(i);
        j++;
        streak++;
        score += 1.2 + streak * 0.45;
      } else {
        streak = 0;
      }
      i++;
    }

    if (j < q.length) return null;

    const span = idx[idx.length - 1] - idx[0] + 1;
    score += 4 - span * 0.03;
    if (idx[0] === 0) score += 2;

    return { score, ranges: idx.map(x => [x, x + 1]) };
  }

  function editDistanceWindowed(text, q, maxD = 2) {
    if (text.length < q.length) return 99;
    let best = 99;
    const L = q.length;
    const limitWindows = Math.min(80, text.length - L + 1);

    for (let i = 0; i < limitWindows; i++) {
      const d = lev(text.slice(i, i + L), q, maxD);
      if (d < best) best = d;
      if (best === 0) return 0;
    }
    return best;
  }

  function lev(a, b, limit = 2) {
    const n = a.length;
    const m = b.length;
    if (Math.abs(n - m) > limit) return limit + 1;

    let prev = Array.from({ length: m + 1 }, (_, i) => i);

    for (let i = 1; i <= n; i++) {
      const cur = [i];
      let minInRow = cur[0];

      for (let j = 1; j <= m; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
        if (cur[j] < minInRow) minInRow = cur[j];
      }

      if (minInRow > limit) return limit + 1;
      prev = cur;
    }

    return prev[m];
  }

  function buildQueryVariants(q) {
    const set = new Set([q]);
    const swapped = swapKeyboardLayout(q);
    if (swapped && swapped !== q) set.add(swapped);
    return [...set];
  }

  function swapKeyboardLayout(s0) {
    const en = '`qwertyuiop[]asdfghjkl;\'zxcvbnm,./';
    const ru = 'ёйцукенгшщзхъфывапролджэячсмитьбю.';
    const map = {};

    for (let i = 0; i < en.length; i++) {
      map[en[i]] = ru[i];
      map[ru[i]] = en[i];
    }

    return [...s0.toLowerCase()].map(ch => map[ch] || ch).join('');
  }

  function highlightRanges(str, ranges) {
    const frag = document.createDocumentFragment();

    if (!ranges?.length) {
      frag.appendChild(document.createTextNode(str));
      return frag;
    }

    const marks = Array(str.length).fill(false);
    for (const [a, b] of ranges) {
      for (let i = a; i < b && i < str.length; i++) marks[i] = true;
    }

    let buf = '';
    let inMark = false;

    const flush = (marked) => {
      if (!buf) return;
      if (marked) {
        const m = document.createElement('mark');
        m.className = 'bm-hl';
        m.textContent = buf;
        frag.appendChild(m);
      } else {
        frag.appendChild(document.createTextNode(buf));
      }
      buf = '';
    };

    for (let i = 0; i < str.length; i++) {
      if (marks[i] !== inMark) { flush(inMark); inMark = marks[i]; }
      buf += str[i];
    }
    flush(inMark);

    return frag;
  }

  function initIp() {
    if (ipInited) return;
    ipInited = true;
    el.ipCheckBtn = document.getElementById('ip-check-btn');
    el.ipOutput = document.getElementById('ip-output');
    el.ipCheckBtn.addEventListener('click', fetchIp);
  }

  async function fetchIp() {
    el.ipCheckBtn.disabled = true;
    el.ipCheckBtn.textContent = '…';
    el.ipOutput.replaceChildren();

    try {
      const res = await fetch('https://api.ipapi.is/');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();

      el.ipOutput.replaceChildren(colorizeJson({
        ip: d.ip,
        country: d.location?.country_code,
        city: d.location?.city,
        timezone: d.location?.timezone,
        asn: `AS${d.asn?.asn}`,
        provider: d.asn?.org,
        type: d.company?.type,
        is_vpn: d.is_vpn,
        is_proxy: d.is_proxy,
        is_tor: d.is_tor,
        is_datacenter: d.is_datacenter
      }));
    } catch (err) {
      const errSpan = document.createElement('span');
      errSpan.className = 'j-warn';
      errSpan.textContent = `"${err.message}"`;
      el.ipOutput.replaceChildren(errSpan);
    } finally {
      el.ipCheckBtn.disabled = false;
      el.ipCheckBtn.textContent = (STRINGS[s.lang] || STRINGS.en).ipCheck;
    }
  }

  function colorizeJson(obj) {
    const vpn = new Set(['is_vpn', 'is_proxy', 'is_tor']);
    const keys = Object.keys(obj);
    const frag = document.createDocumentFragment();

    const span = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      return s;
    };

    frag.appendChild(document.createTextNode('{\n'));

    keys.forEach((key, i) => {
      const val = obj[key];
      const comma = i < keys.length - 1 ? ',' : '';

      frag.appendChild(document.createTextNode('  '));
      frag.appendChild(span('j-key', `"${key}"`));
      frag.appendChild(document.createTextNode(': '));

      if (typeof val === 'boolean') {
        const cls = vpn.has(key)
          ? (val ? 'j-ok' : 'j-dim')
          : key === 'is_datacenter'
            ? (val ? 'j-warn' : 'j-dim')
            : 'j-dim';
        frag.appendChild(span(cls, String(val)));
      } else if (val == null) {
        frag.appendChild(span('j-dim', 'null'));
      } else {
        let cls = 'j-str';
        if (key === 'type' && val === 'isp') cls = 'j-warn';
        if (key === 'type' && (val === 'vpn' || val === 'hosting')) cls = 'j-ok';
        frag.appendChild(span(cls, `"${String(val)}"`));
      }

      frag.appendChild(document.createTextNode(comma + '\n'));
    });

    frag.appendChild(document.createTextNode('}'));
    return frag;
  }

  function focusSearch() {
    if (!s.blocks.search) return;
    el.searchInput.focus({ preventScroll: true });
    const p = el.searchInput.value.length;
    el.searchInput.setSelectionRange(p, p);
    requestAnimationFrame(() => el.searchInput.focus({ preventScroll: true }));
  }

  function normalizeUrl(v) {
    if (!v) return '';
    const raw = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(raw);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
      return u.href;
    } catch {
      return '';
    }
  }

  function hydrate() {
    const raw = parse(localStorage.getItem(K.CFG)) || {};
    const links = parse(localStorage.getItem(K.LINKS));
    return {
      theme: raw.theme || DEF.theme,
      engine: raw.engine || DEF.engine,
      lang: raw.lang || DEF.lang,
      blocks: { ...DEF.blocks, ...(raw.blocks || {}) },
      links: Array.isArray(links) && links.length ? links : DEF_LINKS
    };
  }

  function persist() {
    localStorage.setItem(K.CFG, JSON.stringify({
      theme: s.theme,
      engine: s.engine,
      lang: s.lang,
      blocks: s.blocks
    }));
    localStorage.setItem(K.LINKS, JSON.stringify(s.links));
  }

  function setChecked(sel, val) {
    const n = document.querySelector(sel);
    if (n) n.checked = !!val;
  }

  function parse(v) {
    try { return v ? JSON.parse(v) : null; }
    catch { return null; }
  }

  function id() {
    return Math.random().toString(36).slice(2, 10);
  }
})();

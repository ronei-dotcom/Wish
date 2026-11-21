/* =====================================================================
   Wish List — app
   - guarda tudo no aparelho (abre na hora, funciona sem internet)
   - sincroniza com o Supabase (tabela "wishlist") entre celular e computador
   - cola o link: a função "wish-preview" tenta trazer nome, foto, preço e loja
   ===================================================================== */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
const nowIso = () => new Date().toISOString();

const ICON = {
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13"/><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7"/><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  ext: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  paste: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  refresh: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
};
const ic = (n, s = 22, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

let toastT;
function toast(msg, ms = 2800) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), ms); }

/* ---------- estado e armazenamento local ---------- */
const S = {
  items: [],
  tab: 'want',                 // want | bought
  sort: localStorage.wl_sort || 'new',
  sync: 'idle', syncMsg: '',
};
try { S.items = JSON.parse(localStorage.wl_items || '[]'); } catch { S.items = []; }
const save = () => { try { localStorage.wl_items = JSON.stringify(S.items); } catch (e) { console.warn(e); } };

/* ---------- moedas, preços e lojas ---------- */
const CURS = { BRL: 'R$', PYG: 'Gs', USD: 'US$', EUR: '€' };
function fmt(v, cur) {
  if (v == null || v === '' || isNaN(v)) return '';
  cur = CURS[cur] ? cur : 'BRL';
  try { return new Intl.NumberFormat(cur === 'PYG' ? 'es-PY' : 'pt-BR', { style: 'currency', currency: cur, maximumFractionDigits: cur === 'PYG' ? 0 : 2 }).format(+v); }
  catch { return CURS[cur] + ' ' + (+v).toFixed(2); }
}
// "1.299,90" | "1299.90" | "R$ 1.299" | "Gs. 1.250.000" -> número
function parsePrice(raw) {
  if (raw == null) return null;
  if (typeof raw === 'number') return isFinite(raw) ? raw : null;
  let s = String(raw).replace(/[^\d.,]/g, '');
  if (!/\d/.test(s)) return null;
  const lc = s.lastIndexOf(','), ld = s.lastIndexOf('.');
  const sep = Math.max(lc, ld);
  if (sep >= 0) {
    const dec = s.slice(sep + 1).replace(/[.,]/g, '');
    const int = s.slice(0, sep).replace(/[.,]/g, '');
    // 3 dígitos depois do último separador = milhar (nenhuma moeda tem 3 casas decimais)
    s = dec.length === 3 ? int + dec : int + '.' + dec;
  }
  const n = parseFloat(s);
  return isFinite(n) ? n : null;
}
const priceInput = v => v == null || v === '' ? '' : String(+v).replace('.', ',');

const STORES = [
  [/amazon\./, 'Amazon'], [/mercadoli(vre|bre)|mlstatic|meli\./, 'Mercado Livre'], [/magazineluiza|magalu/, 'Magalu'],
  [/shopee/, 'Shopee'], [/aliexpress/, 'AliExpress'], [/americanas/, 'Americanas'], [/casasbahia/, 'Casas Bahia'],
  [/pontofrio/, 'Ponto'], [/kabum/, 'KaBuM!'], [/netshoes/, 'Netshoes'], [/centauro/, 'Centauro'], [/decathlon/, 'Decathlon'],
  [/shein/, 'Shein'], [/temu\./, 'Temu'], [/ebay\./, 'eBay'], [/walmart/, 'Walmart'], [/bestbuy/, 'Best Buy'],
  [/target\.com/, 'Target'], [/apple\.com/, 'Apple'], [/samsung/, 'Samsung'], [/nike\./, 'Nike'], [/adidas/, 'Adidas'],
  [/zara\./, 'Zara'], [/leroymerlin/, 'Leroy Merlin'], [/fastshop/, 'Fast Shop'], [/carrefour/, 'Carrefour'],
  [/tiendamia/, 'Tiendamia'], [/nissei/, 'Nissei'], [/shoppingchina/, 'Shopping China'], [/cellshop/, 'Cellshop'],
];
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\d?\./, '').toLowerCase(); } catch { return ''; } };
function storeFromUrl(u) {
  const h = hostOf(u); if (!h) return '';
  for (const [re, n] of STORES) if (re.test(h)) return n;
  const parts = h.split('.');
  let core = parts[0];
  if (parts.length > 2 && /^(m|loja|shop|store|br|py)$/.test(core)) core = parts[1];
  return core.charAt(0).toUpperCase() + core.slice(1);
}
function curFromUrl(u) {
  const h = hostOf(u);
  if (/\.br$|mercadolivre|magazineluiza|americanas|casasbahia|kabum/.test(h)) return 'BRL';
  if (/\.py$|nissei|shoppingchina|cellshop/.test(h)) return 'PYG';
  if (/\.(com|us)$/.test(h)) return 'USD';
  return 'BRL';
}
// título provisório a partir do endereço (ex.: amazon.com.br/Echo-Dot-5a-geracao/dp/...)
function titleFromUrl(u) {
  try {
    const segs = new URL(u).pathname.split('/').filter(Boolean).map(decodeURIComponent)
      .filter(s => /[a-z]{3,}.*-|-.*[a-z]{3,}/i.test(s) && !/^(dp|p|produto|product|item|gp)$/i.test(s));
    const s = segs.sort((a, b) => b.length - a.length)[0];
    if (!s) return '';
    return s.replace(/\.(html?|aspx?)$/i, '').replace(/^MLB-?\d+-?/i, '').replace(/[-_]JM$/i, '').replace(/[-_]+/g, ' ').trim()
      .replace(/^./, c => c.toUpperCase()).slice(0, 140);
  } catch { return ''; }
}
const findUrl = t => { const m = String(t || '').match(/https?:\/\/[^\s<>"']+/i); return m ? m[0].replace(/[).,;]+$/, '') : ''; };

/* ---------- leitura automática do link ---------- */
const CFG = window.WISH_CONFIG || {};
const SB_URL = String(CFG.SUPABASE_URL || '').trim().replace(/\/+$/, '');
const SB_KEY = String(CFG.SUPABASE_ANON_KEY || '').trim();

async function preview(url) {
  if (!SB_URL || !SB_KEY) return { error: 'sem Supabase' };
  try {
    const ctl = new AbortController(); const tm = setTimeout(() => ctl.abort(), 20000);
    const r = await fetch(SB_URL + '/functions/v1/wish-preview', {
      method: 'POST', signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      body: JSON.stringify({ url }),
    });
    clearTimeout(tm);
    if (r.status === 404) return { error: 'função não instalada' };
    if (!r.ok) return { error: 'HTTP ' + r.status };
    return await r.json();
  } catch (e) { return { error: e.name === 'AbortError' ? 'demorou demais' : (e.message || 'falhou') }; }
}

/* ---------- Supabase e sincronização ---------- */
let sb = null;
try { if (SB_URL && SB_KEY && window.supabase) sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }
catch (e) { console.warn('Supabase indisponível', e); }

let syncing = false, syncTimer = null, syncAgain = false, lastErr = '';
const dotCls = () => ({ idle: 'ok', busy: 'busy', err: 'err', off: '' }[S.sync] || '');
const syncLabel = () => !sb ? 'Só neste aparelho' : S.sync === 'busy' ? 'Sincronizando…' : S.sync === 'err' ? 'Erro ao sincronizar' : S.sync === 'off' ? 'Sem internet' : 'Sincronizado';
function setSync(st, msg = '') {
  S.sync = st; S.syncMsg = msg;
  const d = $('#syncDot'); if (d) d.className = 'dot ' + dotCls();
  const l = $('#syncLbl'); if (l) l.textContent = syncLabel();
}
function queueSync(ms = 900) { if (!sb) return; clearTimeout(syncTimer); syncTimer = setTimeout(sync, ms); }
const COLS = ['id', 'url', 'title', 'price', 'currency', 'store', 'image', 'notes', 'bought', 'bought_at', 'created_at', 'updated_at', 'deleted'];

async function sync() {
  if (!sb) return;
  if (syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { setSync('off'); return; }
  syncing = true; setSync('busy');
  try {
    // 1) envia o que mudou aqui
    for (const it of S.items.filter(i => i._dirty)) {
      const v = it._v, row = {};
      COLS.forEach(k => row[k] = it[k] ?? null);
      const { error } = await sb.from('wishlist').upsert(row);
      if (error) throw error;
      if (it._v === v) it._dirty = false;
    }
    save();
    // 2) baixa o que mudou nos outros aparelhos
    let from = localStorage.wl_ts || '1970-01-01T00:00:00Z', changed = false;
    for (;;) {
      const { data, error } = await sb.from('wishlist').select('*').gt('server_ts', from).order('server_ts').limit(500);
      if (error) throw error;
      for (const r of data) {
        const i = S.items.findIndex(x => x.id === r.id);
        if (i >= 0) { if (!S.items[i]._dirty) { S.items[i] = r; changed = true; } }
        else { S.items.push(r); changed = true; }
        from = r.server_ts;
      }
      if (data.length < 500) break;
    }
    localStorage.wl_ts = from;
    save(); setSync('idle'); lastErr = '';
    if (changed && $('#sheet').classList.contains('hidden')) render();
  } catch (e) {
    const m = e?.code === 'PGRST205' || /does not exist|could not find the table/i.test(e?.message || '')
      ? 'tabela wishlist não existe — rode o supabase-setup.sql' : (e?.message || String(e));
    setSync(navigator.onLine ? 'err' : 'off', m);
    if (navigator.onLine && m !== lastErr) { toast('Erro ao sincronizar: ' + m, 5000); lastErr = m; }
  } finally {
    syncing = false;
    if (syncAgain) { syncAgain = false; queueSync(300); }
  }
}
function upsertItem(it) {
  it.updated_at = nowIso(); it._dirty = true; it._v = (it._v || 0) + 1;
  const i = S.items.findIndex(x => x.id === it.id);
  if (i >= 0) S.items[i] = it; else S.items.push(it);
  save(); render(); queueSync(400);
}

/* ---------- tela principal ---------- */
const live = () => S.items.filter(i => !i.deleted);
function sorted(list) {
  const p = i => i.price == null ? Infinity : +i.price;
  const by = {
    new: (a, b) => (b.created_at || '').localeCompare(a.created_at || ''),
    old: (a, b) => (a.created_at || '').localeCompare(b.created_at || ''),
    low: (a, b) => p(a) - p(b),
    high: (a, b) => (b.price == null ? -1 : +b.price) - (a.price == null ? -1 : +a.price),
    store: (a, b) => (a.store || '').localeCompare(b.store || '', 'pt'),
  }[S.sort] || (() => 0);
  return [...list].sort(by);
}
function totals(list) {
  const t = {};
  list.forEach(i => { if (i.price != null && !isNaN(i.price)) { const c = CURS[i.currency] ? i.currency : 'BRL'; t[c] = (t[c] || 0) + +i.price; } });
  return Object.entries(t).map(([c, v]) => fmt(v, c));
}

function card(i) {
  const pr = i.price != null && i.price !== '' ? `<div class="pr">${esc(fmt(i.price, i.currency))}</div>` : `<div class="pr none">Sem preço</div>`;
  return `<article class="card ${i.bought ? 'bought' : ''}" data-id="${esc(i.id)}">
    ${i.bought ? '<span class="badge">Comprado</span>' : ''}
    <div class="ph" data-act="edit">${i.image ? `<img src="${esc(i.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">` : `<div class="noimg">${ic('img', 34, 1.4)}</div>`}</div>
    <div class="bd">
      <div class="st">${esc(i.store || storeFromUrl(i.url) || 'Loja')}</div>
      <div class="tt" data-act="edit">${esc(i.title || titleFromUrl(i.url) || 'Sem nome')}</div>
      ${pr}
      <div class="ac">
        ${i.url ? `<a href="${esc(i.url)}" target="_blank" rel="noopener">${ic('ext', 16)} Abrir</a>` : ''}
        <button data-act="edit" title="Editar">${ic('edit', 16)}</button>
        <button class="chk ${i.bought ? 'on' : ''}" data-act="bought" title="${i.bought ? 'Voltar para a lista' : 'Marcar como comprado'}">${ic('check', 17, 2.2)}</button>
      </div>
    </div>
  </article>`;
}

function render() {
  const all = live(), want = all.filter(i => !i.bought), got = all.filter(i => i.bought);
  const list = sorted(S.tab === 'want' ? want : got);
  const tot = totals(want);
  const light = document.documentElement.dataset.theme === 'light';
  $('#view').innerHTML = `
    <div class="top">
      <div class="logo">${ic('gift', 26)}<b>Wish List</b></div>
      <div class="tr">
        <div class="syncb"><span id="syncDot" class="dot ${dotCls()}"></span><span id="syncLbl">${syncLabel()}</span></div>
        <button class="ib" id="theme" title="Tema">${ic(light ? 'moon' : 'sun', 20)}</button>
      </div>
    </div>
    <div class="hero">
      <div class="eyebrow">Minha lista</div>
      <h1>${tot.length ? esc(tot.join(' + ')) : want.length ? 'Sem preços ainda' : 'Nada por aqui'}</h1>
      <div class="sub">${want.length} ${want.length === 1 ? 'item que eu quero' : 'itens que eu quero'}${got.length ? ` · ${got.length} já ${got.length === 1 ? 'comprado' : 'comprados'}` : ''}</div>
    </div>
    <form class="add" id="addF" autocomplete="off">
      <input id="addI" type="text" inputmode="url" placeholder="Cole o link do produto" enterkeyhint="go">
      ${navigator.clipboard?.readText ? `<button type="button" class="btn ghost" id="pasteB" title="Colar">${ic('paste', 20)}</button>` : ''}
      <button class="btn pri" type="submit">Adicionar</button>
    </form>
    <div class="bar">
      <div class="seg">
        <button data-tab="want" class="${S.tab === 'want' ? 'on' : ''}">Quero<span class="n">${want.length}</span></button>
        <button data-tab="bought" class="${S.tab === 'bought' ? 'on' : ''}">Comprados<span class="n">${got.length}</span></button>
      </div>
      <select class="sel" id="sortS">
        ${[['new', 'Mais recentes'], ['old', 'Mais antigos'], ['low', 'Menor preço'], ['high', 'Maior preço'], ['store', 'Por loja']]
      .map(([v, l]) => `<option value="${v}" ${S.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    ${list.length ? `<div class="grid">${list.map(card).join('')}</div>` :
      `<div class="empty"><div class="gi">${ic('gift', 44, 1.4)}</div><h3>${S.tab === 'want' ? 'Sua lista está vazia' : 'Nada comprado ainda'}</h3>
       <div>${S.tab === 'want' ? 'Copie o link de algo que você quer em qualquer loja e cole ali em cima.' : 'Quando comprar algo da lista, toque no ✓ do card.'}</div></div>`}
  `;
}

/* ---------- formulário (adicionar / editar) ---------- */
let sheetItem = null, sheetNew = false;
function closeSheet() { $('#sheet').classList.add('hidden'); $('#sheet').innerHTML = ''; sheetItem = null; render(); }

function sheetLoading(url) {
  const sh = $('#sheet'); sh.classList.remove('hidden');
  sh.innerHTML = `<div class="sh"><div class="hd"><h2>Novo item</h2><button class="ib" data-act="close">${ic('x', 20)}</button></div>
    <div class="loading"><span class="spin"></span><div>Lendo a página da loja…<div class="mut" style="font-size:13px">${esc(hostOf(url))}</div></div></div></div>`;
}

function sheetForm(it, note) {
  sheetItem = it;
  const sh = $('#sheet'); sh.classList.remove('hidden');
  sh.innerHTML = `<div class="sh">
    <div class="hd"><h2>${sheetNew ? 'Novo item' : 'Editar item'}</h2><button class="ib" data-act="close">${ic('x', 20)}</button></div>
    ${note ? `<div class="msg ${note.ok ? 'ok' : 'warn'}">${esc(note.t)}</div>` : ''}
    <div class="prev"><div class="pi" id="pImg">${it.image ? `<img src="${esc(it.image)}" alt="" referrerpolicy="no-referrer">` : ic('img', 30, 1.4)}</div>
      <div class="pt">${esc(it.title || 'Sem nome')}</div></div>
    <form id="itF" autocomplete="off">
      <label class="fl"><span>Nome</span><input name="title" value="${esc(it.title)}" placeholder="Nome do produto"></label>
      <div class="row">
        <label class="fl"><span>Valor</span><input name="price" inputmode="decimal" value="${esc(priceInput(it.price))}" placeholder="0,00"></label>
        <label class="fl cur"><span>Moeda</span><select name="currency">${Object.entries(CURS).map(([c, s]) => `<option value="${c}" ${it.currency === c ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
      </div>
      <label class="fl"><span>Loja</span><input name="store" value="${esc(it.store)}" placeholder="Loja"></label>
      <label class="fl"><span>Link</span><input name="url" type="url" value="${esc(it.url)}" placeholder="https://"></label>
      <label class="fl"><span>Link da foto (opcional)</span><input name="image" value="${esc(it.image)}" placeholder="https://… .jpg"></label>
      <label class="fl"><span>Observação (tamanho, cor…)</span><textarea name="notes" placeholder="Opcional">${esc(it.notes)}</textarea></label>
      <div class="acts"><button class="btn pri" type="submit">Salvar</button></div>
      ${sheetNew ? '' : `<div class="acts2">
        <button type="button" class="btn sec" data-act="refetch">${ic('refresh', 16)} Atualizar dados</button>
        <button type="button" class="btn sec" data-act="toggle">${ic('check', 16)} ${it.bought ? 'Voltar p/ lista' : 'Comprado'}</button>
        <button type="button" class="btn dan" data-act="del">Excluir</button></div>`}
    </form></div>`;
  const f = $('#itF');
  f.image.addEventListener('change', () => { const v = f.image.value.trim(); $('#pImg').innerHTML = v ? `<img src="${esc(v)}" alt="" referrerpolicy="no-referrer">` : ic('img', 30, 1.4); });
  if (sheetNew && it.price == null) setTimeout(() => f.price.focus(), 250);
}

function applyPreview(it, p) {
  if (p.title) it.title = p.title;
  if (p.image) it.image = p.image;
  const v = parsePrice(p.price);
  if (v != null && v > 0) it.price = v;
  if (p.currency && CURS[p.currency]) it.currency = p.currency;
  if (p.store) it.store = p.store.length > 30 ? storeFromUrl(it.url) : p.store;
}
function previewNote(p, it) {
  if (p.error) return { t: p.error === 'função não instalada'
    ? 'O preenchimento automático ainda não está ativado no Supabase. Preencha o que faltar.'
    : 'Não consegui ler essa loja. Preencha o que faltar.' };
  const miss = [];
  if (it.price == null) miss.push('o preço');
  if (!it.image) miss.push('a foto');
  if (!it.title) miss.push('o nome');
  return miss.length ? { t: `Não achei ${miss.join(' e ')}. Coloque à mão.` } : { t: 'Dados trazidos da loja. Confira e salve.', ok: true };
}

async function addFromText(text) {
  const url = findUrl(text) || (/^[\w-]+(\.[\w-]+)+\//.test(String(text).trim()) ? 'https://' + String(text).trim() : '');
  if (!url) { toast('Cole um link de produto (começando com http)'); return; }
  const dup = live().find(i => i.url === url);
  if (dup) { toast('Esse link já está na lista'); sheetNew = false; sheetForm({ ...dup }); return; }
  sheetNew = true;
  const it = { id: uid(), url, title: '', price: null, currency: curFromUrl(url), store: storeFromUrl(url), image: '', notes: '', bought: false, bought_at: null, created_at: nowIso(), deleted: false };
  sheetLoading(url);
  const p = await preview(url);
  if (!$('#sheet').innerHTML) return;          // fechou enquanto carregava
  applyPreview(it, p);
  if (!it.title) it.title = titleFromUrl(url);
  sheetForm(it, previewNote(p, it));
}

function readForm() {
  const f = $('#itF'), it = { ...sheetItem };
  it.title = f.title.value.trim();
  it.price = parsePrice(f.price.value);
  it.currency = f.currency.value;
  it.store = f.store.value.trim();
  it.url = f.url.value.trim();
  it.image = f.image.value.trim();
  it.notes = f.notes.value.trim();
  return it;
}

/* ---------- eventos ---------- */
document.addEventListener('submit', e => {
  e.preventDefault();
  if (e.target.id === 'addF') { const v = $('#addI').value; $('#addI').value = ''; addFromText(v); }
  if (e.target.id === 'itF') {
    const it = readForm();
    if (!it.title && !it.url) { toast('Coloque pelo menos o nome ou o link'); return; }
    upsertItem(it); closeSheet(); toast(sheetNew ? 'Adicionado à lista' : 'Salvo');
  }
});

document.addEventListener('click', async e => {
  const t = e.target.closest('[data-act],[data-tab],#theme,#pasteB');
  if (!t) { if (e.target.id === 'sheet') closeSheet(); return; }
  if (t.id === 'theme') {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    localStorage.wl_theme = light ? 'light' : 'dark';
    $('meta[name=theme-color]').content = light ? '#eef1f4' : '#121a2a';
    render(); return;
  }
  if (t.id === 'pasteB') {
    try { const txt = await navigator.clipboard.readText(); if (txt) addFromText(txt); else toast('Nada copiado'); }
    catch { toast('Toque e segure no campo para colar'); $('#addI').focus(); }
    return;
  }
  if (t.dataset.tab) { S.tab = t.dataset.tab; render(); return; }
  const act = t.dataset.act;
  if (act === 'close') { closeSheet(); return; }

  const cardEl = t.closest('.card');
  if (cardEl) {
    const it = S.items.find(i => i.id === cardEl.dataset.id); if (!it) return;
    if (act === 'edit') { sheetNew = false; sheetForm({ ...it }); }
    if (act === 'bought') {
      const n = { ...it, bought: !it.bought, bought_at: !it.bought ? nowIso() : null };
      upsertItem(n); toast(n.bought ? 'Marcado como comprado 🎉' : 'Voltou para a lista');
    }
    return;
  }
  if (!sheetItem) return;
  if (act === 'toggle') {
    const it = readForm(); it.bought = !it.bought; it.bought_at = it.bought ? nowIso() : null;
    upsertItem(it); closeSheet(); toast(it.bought ? 'Marcado como comprado 🎉' : 'Voltou para a lista');
  }
  if (act === 'del') {
    if (!confirm('Excluir este item da lista?')) return;
    upsertItem({ ...sheetItem, deleted: true }); closeSheet(); toast('Excluído');
  }
  if (act === 'refetch') {
    const it = readForm();
    if (!it.url) { toast('Esse item não tem link'); return; }
    t.disabled = true; t.innerHTML = '<span class="spin"></span> Lendo…';
    const p = await preview(it.url);
    const before = it.price;
    applyPreview(it, p);
    const note = p.error ? previewNote(p, it)
      : { ok: true, t: before != null && it.price != null && +before !== +it.price
          ? `Preço mudou: ${fmt(before, it.currency)} → ${fmt(it.price, it.currency)}. Toque em Salvar para guardar.`
          : 'Dados atualizados. Toque em Salvar para guardar.' };
    sheetForm(it, note);
  }
});

document.addEventListener('change', e => {
  if (e.target.id === 'sortS') { S.sort = e.target.value; localStorage.wl_sort = S.sort; render(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').classList.contains('hidden')) closeSheet(); });

/* ---------- início ---------- */
if (localStorage.wl_theme === 'light') { document.documentElement.dataset.theme = 'light'; $('meta[name=theme-color]').content = '#eef1f4'; }
render();
if (sb) {
  sync();
  try { sb.channel('wishlist-live').on('postgres_changes', { event: '*', schema: 'public', table: 'wishlist' }, () => queueSync(300)).subscribe(); } catch { }
  window.addEventListener('online', () => queueSync(200));
  window.addEventListener('offline', () => setSync('off'));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queueSync(200); });
}
// link compartilhado de outro app (Android: Compartilhar > Wish List)
(() => {
  const q = new URLSearchParams(location.search);
  const shared = [q.get('url'), q.get('text'), q.get('title')].filter(Boolean).join(' ');
  if (shared) { history.replaceState(null, '', location.pathname); addFromText(shared); }
})();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });

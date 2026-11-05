/* Núcleo compartilhado: utilidades, API (json-server ou dados locais), preços, disponibilidade,
   calendário, galeria e cabeçalho. */
window.EV = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const icon = (n, cls = '') => `<svg class="ico ${cls}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Datas ---------- */
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MON = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const DOW = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const parse = s => { if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const diffDays = (a, b) => Math.round((b - a) / 864e5);
  const same = (a, b) => !!a && !!b && a.getTime() === b.getTime();
  const fmtShort = d => `${d.getDate()} ${MON[d.getMonth()]}`;
  const fmtDate = d => `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const fmtLong = d => `${DOW[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  const fmtRange = (a, b) => a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()
    ? `${a.getDate()} a ${b.getDate()} de ${MONTHS[a.getMonth()]}`
    : `${fmtShort(a)} a ${fmtShort(b)}`;
  // 5 → "5,0"; 4.98 → "4,98" (como o Airbnb mostra)
  const fmtNota = n => (Math.round(n * 10) / 10 === n ? n.toFixed(1) : n.toFixed(2)).replace('.', ',');
  const plural = (n, s, p) => `${n} ${n === 1 ? s : p}`;

  const brl = (n, dec) => {
    const d = dec ?? (Math.round(n * 100) % 100 ? 2 : 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: d, maximumFractionDigits: d });
  };

  /* ---------- Imagens ---------- */
  const imgBase = (chale) => `assets/img/${chale.slug}`;
  function img(chale, nome, sizes, { alt, eager, cls = '' } = {}) {
    const f = chale.fotos.find(p => p.arquivo === nome) || { arquivo: nome, alt: '', w: 1200, h: 1600, w640: 640 };
    const b = imgBase(chale);
    return `<img class="${cls}" src="${b}/${f.arquivo}-640.webp" srcset="${b}/${f.arquivo}-640.webp ${f.w640}w, ${b}/${f.arquivo}-1200.webp ${f.w}w" sizes="${sizes}" width="${f.w}" height="${f.h}" alt="${esc(alt ?? f.alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy" decoding="async"'}>`;
  }

  // Fotos das experiências ficam numa pasta comum a todos os chalés
  function pkgImg(p, sizes, { alt = '' } = {}) {
    const m = p.fotoMeta || { w: 1200, h: 1600, w640: 640 }, b = 'assets/img/pacotes';
    return `<img src="${b}/${p.foto}-640.webp" srcset="${b}/${p.foto}-640.webp ${m.w640}w, ${b}/${p.foto}-1200.webp ${m.w}w" sizes="${sizes}" width="${m.w}" height="${m.h}" alt="${esc(alt)}" loading="lazy" decoding="async">`;
  }

  /* ---------- API ---------- */
  // Com o json-server rodando (npm start) os dados vêm de /chales, /reservas...
  // Abrindo o HTML direto do disco, usa window.MOCK_DB e guarda reservas novas no navegador.
  let mode = null;
  const LS = 'ev-reservas-v1';
  let memory = null;
  async function detect() {
    if (mode) return mode;
    if (location.protocol === 'file:') return (mode = 'local');
    try {
      const r = await fetch('/chales?_limit=1', { cache: 'no-store' });
      mode = r.ok && (r.headers.get('content-type') || '').includes('json') ? 'server' : 'local';
    } catch { mode = 'local'; }
    return mode;
  }
  const clone = o => JSON.parse(JSON.stringify(o));
  function localReservas() {
    if (memory) return memory;
    try { const s = localStorage.getItem(LS); if (s) return (memory = JSON.parse(s)); } catch {}
    return (memory = clone(window.MOCK_DB.reservas));
  }
  function saveLocal(arr) { memory = arr; try { localStorage.setItem(LS, JSON.stringify(arr)); } catch {} }
  async function get(path) {
    const r = await fetch(path, { cache: 'no-store' });
    if (!r.ok) throw new Error(`Falha ao carregar ${path}`);
    return r.json();
  }
  async function send(path, method, body) {
    const r = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) {
      let msg = 'Não foi possível salvar a reserva. Tente de novo em instantes.';
      try { const j = await r.json(); if (j && j.erro) msg = j.erro; } catch {}
      throw new Error(msg);
    }
    return r.json();
  }
  const api = {
    async mode() { return detect(); },
    async chales() { return (await detect()) === 'server' ? get('/chales') : clone(window.MOCK_DB.chales); },
    async chale(slug) {
      const list = (await detect()) === 'server' ? await get(`/chales?slug=${encodeURIComponent(slug)}`) : window.MOCK_DB.chales.filter(c => c.slug === slug);
      return list[0] ? clone(list[0]) : null;
    },
    async pacotes() { return (await detect()) === 'server' ? get('/pacotes') : clone(window.MOCK_DB.pacotes); },
    async reservas(chaleId) {
      const all = (await detect()) === 'server' ? await get(`/reservas?chaleId=${chaleId}`) : localReservas().filter(r => r.chaleId === chaleId);
      // Pix não pago dentro do prazo libera as datas
      return all.filter(r => r.status !== 'cancelada' && !(r.status === 'aguardando-pagamento' && r.pagamento && new Date(r.pagamento.expiraEm) < new Date()));
    },
    async reserva(codigo) {
      const list = (await detect()) === 'server' ? await get(`/reservas?codigo=${encodeURIComponent(codigo)}`) : localReservas().filter(r => r.codigo === codigo);
      return list[0] || null;
    },
    async criarReserva(data) {
      if ((await detect()) === 'server') return send('/reservas', 'POST', data);
      const arr = localReservas();
      const r = { ...data, id: Math.max(0, ...arr.map(x => x.id)) + 1 };
      arr.push(r); saveLocal(arr); return r;
    },
    async atualizarReserva(id, patch) {
      if ((await detect()) === 'server') return send(`/reservas/${id}`, 'PATCH', patch);
      const arr = localReservas(); const r = arr.find(x => x.id === id);
      Object.assign(r, patch); saveLocal(arr); return r;
    },
    async cupom(codigo) {
      const c = String(codigo || '').trim().toUpperCase(); if (!c) return null;
      const list = (await detect()) === 'server' ? await get(`/cupons?codigo=${encodeURIComponent(c)}`) : window.MOCK_DB.cupons.filter(x => x.codigo === c);
      return list[0] || null;
    }
  };

  /* ---------- Preços ---------- */
  function rate(chale, d) {
    const t = chale.tarifas, k = iso(d);
    const esp = t.especiais.find(e => e.data === k);
    if (esp) return { valor: esp.valor, tipo: 'especial', nome: esp.nome };
    const w = d.getDay();
    return w === 5 || w === 6 ? { valor: t.fimDeSemana, tipo: 'fds' } : { valor: t.semana, tipo: 'semana' };
  }
  function quote(chale, inD, outD, { pacotes = [], cupom = null, metodo = 'pix' } = {}) {
    const noites = [];
    for (let d = inD; d < outD; d = addDays(d, 1)) noites.push({ data: d, ...rate(chale, d) });
    const grupos = {};
    noites.forEach(n => {
      const key = n.tipo === 'especial' ? `esp-${n.nome}-${n.valor}` : n.tipo;
      const label = n.tipo === 'semana' ? 'Diárias de domingo a quinta' : n.tipo === 'fds' ? 'Diárias de sexta e sábado' : `Diárias de ${n.nome}`;
      (grupos[key] ||= { label, valor: n.valor, qtd: 0 }).qtd++;
    });
    const hospedagem = noites.reduce((s, n) => s + n.valor, 0);
    const limpeza = noites.length ? chale.tarifas.limpeza : 0;
    const extras = pacotes.reduce((s, p) => s + p.preco, 0);
    const descCupom = cupom ? Math.round(hospedagem * cupom.percentual) / 100 : 0;
    const subtotal = hospedagem + limpeza + extras - descCupom;
    const descPix = metodo === 'pix' ? Math.round(subtotal * chale.pagamento.descontoPix) / 100 : 0;
    const total = Math.round((subtotal - descPix) * 100) / 100;
    return { noites, grupos: Object.values(grupos), hospedagem, limpeza, extras, descCupom, subtotal, descPix, total };
  }
  const minRate = chale => Math.min(chale.tarifas.semana, chale.tarifas.fimDeSemana);

  /* ---------- Disponibilidade ---------- */
  // Uma noite está ocupada se alguma reserva tem checkin <= noite < checkout.
  function bookedSet(reservas) {
    const s = new Set();
    reservas.forEach(r => { for (let d = parse(r.checkin); d < parse(r.checkout); d = addDays(d, 1)) s.add(iso(d)); });
    return s;
  }
  const nightFree = (set, d) => !set.has(iso(d)) && d >= today();
  function rangeFree(set, a, b) { for (let d = a; d < b; d = addDays(d, 1)) if (set.has(iso(d))) return false; return true; }
  function maxCheckout(set, inD, limit = 30) {
    for (let i = 0; i < limit; i++) { const d = addDays(inD, i); if (set.has(iso(d))) return d; }
    return addDays(inD, limit);
  }
  // Próximos fins de semana (sexta a domingo) livres
  function nextWeekends(set, n = 3) {
    const out = []; let d = today();
    while (d.getDay() !== 5) d = addDays(d, 1);
    for (let i = 0; i < 26 && out.length < n; i++, d = addDays(d, 7)) if (rangeFree(set, d, addDays(d, 2))) out.push(d);
    return out;
  }

  /* ---------- Calendário ---------- */
  // state = { in: Date|null, out: Date|null }. Vários calendários podem compartilhar o mesmo estado.
  class Calendar {
    constructor(el, opts) {
      this.el = el; this.o = Object.assign({ months: 1, prices: false, minNights: 1 }, opts);
      this.view = new Date((opts.state.in || today()).getFullYear(), (opts.state.in || today()).getMonth(), 1);
      this.hover = null;
      el.classList.add('calendar');
      el.addEventListener('click', e => this.click(e));
      el.addEventListener('mouseover', e => { const b = e.target.closest('.cd'); if (b && this.o.state.in && !this.o.state.out) { this.hover = parse(b.dataset.d); this.paintRange(); } });
      el.addEventListener('mouseleave', () => { this.hover = null; this.paintRange(); });
      el.addEventListener('keydown', e => this.key(e));
      this.render();
    }
    get st() { return this.o.state; }
    goTo(d) { this.view = new Date(d.getFullYear(), d.getMonth(), 1); this.render(); }
    shift(n) {
      const t = today(); const v = new Date(this.view.getFullYear(), this.view.getMonth() + n, 1);
      if (v < new Date(t.getFullYear(), t.getMonth(), 1)) return;
      this.view = v; this.render();
    }
    dayState(d) {
      const { in: a, out: b } = this.st, set = this.o.booked;
      const past = d < today();
      const booked = set.has(iso(d));
      let disabled = past;
      if (!disabled && a && !b && d > a) disabled = d > maxCheckout(set, a);       // escolhendo check-out
      else if (!disabled && booked) {
        // noite ocupada: só pode ser escolhida como check-out
        disabled = !(a && !b && d > a && d <= maxCheckout(set, a));
      }
      return { past, booked, disabled };
    }
    month(y, m, showNav) {
      const first = new Date(y, m, 1).getDay(), days = new Date(y, m + 1, 0).getDate();
      const t = today(), canPrev = new Date(y, m, 1) > new Date(t.getFullYear(), t.getMonth(), 1);
      let h = `<div class="cal-month"><div class="cal-head">`;
      h += showNav.prev ? `<button type="button" class="cal-nav" data-nav="-1" aria-label="Mês anterior" ${canPrev ? '' : 'disabled'}>${icon('left')}</button>` : '<span class="cal-nav-sp"></span>';
      h += `<span class="cal-title">${MONTHS[m]} ${y}</span>`;
      h += showNav.next ? `<button type="button" class="cal-nav" data-nav="1" aria-label="Próximo mês">${icon('right')}</button>` : '<span class="cal-nav-sp"></span>';
      h += `</div><div class="cal-grid" role="grid">`;
      h += ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((x, i) => `<span class="cal-dow" title="${DOW[i]}">${x}</span>`).join('');
      for (let i = 0; i < first; i++) h += '<span></span>';
      for (let i = 1; i <= days; i++) {
        const d = new Date(y, m, i), s = this.dayState(d);
        const cls = ['cd'];
        if (s.booked) cls.push('booked');
        if (same(d, t)) cls.push('today');
        if (same(d, this.st.in)) cls.push('start');
        if (same(d, this.st.out)) cls.push('end');
        if (this.st.in && this.st.out && d > this.st.in && d < this.st.out) cls.push('mid');
        const r = this.o.prices && !s.past && !s.booked ? rate(this.o.chale, d) : null;
        const label = `${DOW[d.getDay()]}, ${i} de ${MONTHS[m]}${s.booked ? ', ocupado' : ''}${r ? `, ${brl(r.valor)} a noite` : ''}`;
        h += `<button type="button" class="${cls.join(' ')}${r && r.tipo === 'especial' ? ' special' : ''}" data-d="${iso(d)}" ${s.disabled ? 'disabled' : ''} aria-label="${label}" tabindex="-1"><span class="cd-n">${i}</span>${r ? `<span class="cd-p">${r.valor}</span>` : ''}</button>`;
      }
      return h + '</div></div>';
    }
    render() {
      const n = this.o.months; let h = '<div class="cal-months">';
      for (let i = 0; i < n; i++) {
        const v = new Date(this.view.getFullYear(), this.view.getMonth() + i, 1);
        h += this.month(v.getFullYear(), v.getMonth(), { prev: i === 0, next: i === n - 1 });
      }
      this.el.innerHTML = h + '</div>';
      const focusable = $('.cd.start', this.el) || $('.cd:not(:disabled)', this.el);
      if (focusable) focusable.tabIndex = 0;
      this.paintRange();
    }
    paintRange() {
      const { in: a, out: b } = this.st;
      $$('.cd', this.el).forEach(btn => {
        const d = parse(btn.dataset.d);
        btn.classList.toggle('preview', !!(a && !b && this.hover && d > a && d <= this.hover && !btn.disabled));
      });
    }
    click(e) {
      const nav = e.target.closest('[data-nav]');
      if (nav) { e.stopPropagation(); this.shift(+nav.dataset.nav); return; }
      const b = e.target.closest('.cd'); if (!b || b.disabled) return;
      e.stopPropagation();
      this.pick(parse(b.dataset.d));
    }
    pick(d) {
      const st = this.st, set = this.o.booked;
      if (!st.in || st.out || d <= st.in) {
        if (set.has(iso(d))) return;
        st.in = d; st.out = null;
      } else {
        if (diffDays(st.in, d) < this.o.minNights) { this.o.onHint && this.o.onHint(`Mínimo de ${this.o.minNights} noites. Escolha o check-out a partir de ${fmtShort(addDays(st.in, this.o.minNights))}.`); return; }
        st.out = d;
      }
      this.o.onChange && this.o.onChange(st);
    }
    key(e) {
      const b = e.target.closest('.cd'); if (!b) return;
      const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (e.key in map) {
        e.preventDefault();
        const d = addDays(parse(b.dataset.d), map[e.key]);
        let t = $(`.cd[data-d="${iso(d)}"]`, this.el);
        if (!t) { this.shift(map[e.key] > 0 ? 1 : -1); t = $(`.cd[data-d="${iso(d)}"]`, this.el); }
        if (t) { $$('.cd', this.el).forEach(x => x.tabIndex = -1); t.tabIndex = 0; t.focus(); }
      }
    }
  }

  /* ---------- Popover genérico ---------- */
  let openPop = null;
  function popover(trigger, panel, { onOpen } = {}) {
    const open = () => {
      if (openPop && openPop.panel !== panel) openPop.close();
      panel.classList.add('open'); trigger.setAttribute('aria-expanded', 'true');
      openPop = { panel, close };
      onOpen && onOpen();
      if (innerWidth < 760) setTimeout(() => panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 40);
    };
    const close = () => { panel.classList.remove('open'); trigger.setAttribute('aria-expanded', 'false'); if (openPop && openPop.panel === panel) openPop = null; };
    trigger.addEventListener('click', e => { e.stopPropagation(); panel.classList.contains('open') ? close() : open(); });
    panel.addEventListener('click', e => e.stopPropagation());
    return { open, close, get isOpen() { return panel.classList.contains('open'); } };
  }
  document.addEventListener('click', () => openPop && openPop.close());
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && openPop) openPop.close(); });

  /* ---------- Galeria (lightbox) ---------- */
  function lightbox(chale) {
    let lb = $('.lb');
    if (!lb) {
      document.body.insertAdjacentHTML('beforeend', `
      <dialog class="lb" aria-label="Fotos do ${esc(chale.nome)}">
        <div class="lb-top"><div class="lb-filters" role="group" aria-label="Filtrar por ambiente"></div>
          <button class="lb-close" type="button" aria-label="Fechar fotos">${icon('x')}</button></div>
        <div class="lb-stage">
          <button class="lb-nav lb-prev" type="button" aria-label="Foto anterior">${icon('left')}</button>
          <figure><img alt=""><figcaption></figcaption></figure>
          <button class="lb-nav lb-next" type="button" aria-label="Próxima foto">${icon('right')}</button>
        </div>
        <div class="lb-thumbs"></div>
      </dialog>`);
      lb = $('.lb');
    }
    const all = chale.fotos, base = imgBase(chale);
    const cats = ['Todas', ...new Set(all.map(p => p.categoria))];
    let list = all, idx = 0, last = null;
    const F = $('.lb-filters', lb), T = $('.lb-thumbs', lb), I = $('.lb-stage img', lb), C = $('figcaption', lb);
    F.innerHTML = cats.map(c => `<button type="button" data-c="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('');
    const setCat = c => {
      list = c === 'Todas' ? all : all.filter(p => p.categoria === c);
      $$('button', F).forEach(b => b.setAttribute('aria-pressed', b.dataset.c === c));
      T.innerHTML = list.map((p, i) => `<button type="button" data-i="${i}" aria-label="Foto ${i + 1}"><img src="${base}/${p.arquivo}-640.webp" alt="" loading="lazy"></button>`).join('');
    };
    const show = i => {
      idx = (i + list.length) % list.length; const p = list[idx];
      I.src = `${base}/${p.arquivo}-1200.webp`; I.alt = p.alt;
      C.innerHTML = `<span>${idx + 1} de ${list.length}</span> ${esc(p.alt)}`;
      $$('button', T).forEach((b, j) => b.setAttribute('aria-current', j === idx));
      T.children[idx] && T.children[idx].scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    F.onclick = e => { const b = e.target.closest('button'); if (b) { setCat(b.dataset.c); show(0); } };
    T.onclick = e => { const b = e.target.closest('button'); b && show(+b.dataset.i); };
    $('.lb-prev', lb).onclick = () => show(idx - 1);
    $('.lb-next', lb).onclick = () => show(idx + 1);
    $('.lb-close', lb).onclick = () => lb.close();
    lb.onkeydown = e => { if (e.key === 'ArrowRight') show(idx + 1); if (e.key === 'ArrowLeft') show(idx - 1); };
    lb.onclose = () => { document.documentElement.style.overflow = ''; last && last.focus(); };
    let tx = null;
    $('.lb-stage', lb).ontouchstart = e => tx = e.touches[0].clientX;
    $('.lb-stage', lb).ontouchend = e => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; if (Math.abs(dx) > 40) show(idx + (dx < 0 ? 1 : -1)); tx = null; };
    return {
      open(cat = 'Todas', arquivo) {
        last = document.activeElement; setCat(cat);
        show(arquivo ? Math.max(0, list.findIndex(p => p.arquivo === arquivo)) : 0);
        lb.showModal(); document.documentElement.style.overflow = 'hidden';
      }
    };
  }

  /* ---------- Avisos ---------- */
  function toast(msg) {
    let t = $('.toast');
    if (!t) { document.body.insertAdjacentHTML('beforeend', '<div class="toast" role="status" aria-live="polite"></div>'); t = $('.toast'); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---------- Cabeçalho ---------- */
  function header() {
    const h = $('.site-header'); if (!h) return;
    let ticking = false;
    const on = () => { h.classList.toggle('scrolled', scrollY > 24); ticking = false; };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(on); } }, { passive: true }); on();

    // menu mobile em gaveta lateral
    const b = $('.burger', h), d = $('#menu-mobile');
    if (!b || !d) return;
    const panel = $('.drawer-panel', d);
    let last = null;
    const focusables = () => $$('a, button', panel);
    const open = () => {
      last = document.activeElement; d.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => d.classList.add('open')));
      b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-label', 'Fechar menu');
      document.documentElement.style.overflow = 'hidden';
      setTimeout(() => focusables()[1] && focusables()[1].focus(), 120);
    };
    const close = () => {
      d.classList.remove('open'); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-label', 'Abrir menu');
      document.documentElement.style.overflow = '';
      setTimeout(() => { d.hidden = true; }, 450);
      last && last.focus && last.focus();
    };
    b.addEventListener('click', e => { e.stopPropagation(); d.hidden ? open() : close(); });
    $$('[data-close]', d).forEach(x => x.addEventListener('click', close));
    $$('a', d).forEach(a => a.addEventListener('click', close));
    d.addEventListener('keydown', e => {
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') {
        const f = focusables(), first = f[0], lastEl = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
      }
    });
    addEventListener('resize', () => { if (innerWidth > 960 && !d.hidden) close(); });
  }
  document.addEventListener('DOMContentLoaded', header);

  /* ---------- Seletor de estadia (datas + hóspedes) ---------- */
  // Liga botões de check-in/check-out/hóspedes a popovers com calendário e contador.
  function stayPicker(o) {
    const st = o.state; // { in, out, guests }
    const max = o.maxGuests || 2, min = o.minNights || 1;
    const hint = $('.pop-hint', o.popCal), nightsEl = $('[data-nights]', o.popCal), clear = $('.clear', o.popCal);
    let cal;
    const say = (t, warn) => { if (hint) { hint.textContent = t; hint.classList.toggle('warn', !!warn); } };
    const refreshHint = () => {
      if (!st.in) say('Escolha o dia de chegada');
      else if (!st.out) say(`Chegada em ${fmtShort(st.in)}. Agora escolha o dia de saída.`);
      else say(`${fmtRange(st.in, st.out)}`);
      if (nightsEl) nightsEl.textContent = st.in && st.out ? plural(diffDays(st.in, st.out), 'noite', 'noites') : `Mínimo de ${plural(min, 'noite', 'noites')}`;
      if (clear) clear.disabled = !st.in;
    };
    const paint = () => {
      const set = (el, v, empty) => { const x = $('.pf-v', el); x.textContent = v || empty; x.classList.toggle('set', !!v); };
      set(o.fieldIn, st.in && fmtShort(st.in), 'Escolher data');
      set(o.fieldOut, st.out && fmtShort(st.out), 'Escolher data');
      if (o.fieldG) set(o.fieldG, st.guests === 1 ? '1 adulto' : `${st.guests} adultos`, '');
      if (o.popG) {
        $('output', o.popG).textContent = st.guests;
        $('[data-g="-1"]', o.popG).disabled = st.guests <= 1;
        $('[data-g="1"]', o.popG).disabled = st.guests >= max;
      }
      refreshHint();
    };
    const calPop = { open: null, close: null };
    const openCal = (focus) => {
      // decide qual campo está "ativo"
      o.fieldIn.setAttribute('aria-expanded', String(focus === 'in'));
      o.fieldOut.setAttribute('aria-expanded', String(focus === 'out'));
      if (openPop && openPop.panel !== o.popCal) openPop.close();
      o.popCal.classList.add('open');
      openPop = { panel: o.popCal, close: closeCal };
      cal.render(); refreshHint();
      if (innerWidth < 760) setTimeout(() => o.popCal.scrollIntoView({ block: 'nearest', behavior: 'smooth' }), 40);
      setTimeout(() => { const t = $('.cd[tabindex="0"]', o.popCal); t && t.focus({ preventScroll: true }); }, 30);
    };
    function closeCal() {
      o.popCal.classList.remove('open');
      o.fieldIn.setAttribute('aria-expanded', 'false'); o.fieldOut.setAttribute('aria-expanded', 'false');
      if (openPop && openPop.panel === o.popCal) openPop = null;
    }
    calPop.open = openCal; calPop.close = closeCal;
    cal = new Calendar($('.cal-host', o.popCal), {
      state: st, months: innerWidth < 760 ? 1 : (o.months || 1), booked: o.booked, chale: o.chale, prices: !!o.prices,
      minNights: min,
      onHint: t => say(t, true),
      onChange: () => {
        paint(); cal.render();
        o.onChange && o.onChange(st);
        if (st.out) setTimeout(closeCal, 220);
        else { o.fieldIn.setAttribute('aria-expanded', 'false'); o.fieldOut.setAttribute('aria-expanded', 'true'); }
      }
    });
    o.fieldIn.addEventListener('click', e => { e.stopPropagation(); o.popCal.classList.contains('open') && o.fieldIn.getAttribute('aria-expanded') === 'true' ? closeCal() : openCal('in'); });
    o.fieldOut.addEventListener('click', e => { e.stopPropagation(); if (o.popCal.classList.contains('open') && o.fieldOut.getAttribute('aria-expanded') === 'true') return closeCal(); if (st.out) { st.out = null; paint(); cal.render(); o.onChange && o.onChange(st); } openCal(st.in ? 'out' : 'in'); });
    o.popCal.addEventListener('click', e => e.stopPropagation());
    if (clear) clear.addEventListener('click', () => { st.in = st.out = null; paint(); cal.render(); o.onChange && o.onChange(st); openCal('in'); });
    let gp = null;
    if (o.fieldG && o.popG) {
      gp = popover(o.fieldG, o.popG);
      $$('[data-g]', o.popG).forEach(b => b.addEventListener('click', () => { st.guests = Math.min(max, Math.max(1, st.guests + +b.dataset.g)); paint(); o.onChange && o.onChange(st); }));
    }
    paint();
    return { open: openCal, close: closeCal, paint, cal, setBooked(set) { cal.o.booked = set; cal.render(); } };
  }

  const qs = new URLSearchParams(location.search);

  return { $, $$, icon, esc, MONTHS, MON, DOW, today, iso, parse, addDays, diffDays, same, fmtShort, fmtDate, fmtLong, fmtRange, plural, fmtNota, brl,
    img, imgBase, pkgImg, api, rate, quote, minRate, bookedSet, nightFree, rangeFree, maxCheckout, nextWeekends, Calendar, popover, stayPicker, lightbox, toast, qs };
})();

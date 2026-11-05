(async () => {
  const { $, $$, icon, esc, api, img, pkgImg, brl, fmtRange, fmtShort, plural, diffDays, addDays, iso, bookedSet, rangeFree, nextWeekends, quote, minRate, stayPicker } = EV;

  const [chales, pacotes] = await Promise.all([api.chales(), api.pacotes()]);
  const reservas = {};
  await Promise.all(chales.map(async c => { reservas[c.id] = bookedSet(await api.reservas(c.id)); }));
  const main = chales[0];

  // No calendário da home só ficam riscadas as noites em que TODOS os chalés estão ocupados.
  const sets = Object.values(reservas);
  const allBusy = new Set([...sets[0]].filter(d => sets.every(s => s.has(d))));

  const st = { in: null, out: null, guests: 2 };
  const note = $('.picker-note');

  const picker = stayPicker({
    state: st, fieldIn: $('#f-in'), fieldOut: $('#f-out'), fieldG: $('#f-g'),
    popCal: $('#pop-cal'), popG: $('#pop-g'), months: 2, booked: allBusy, minNights: main.tarifas.minNoites,
    onChange: () => { renderNote(); renderList(); }
  });

  function renderNote() {
    if (st.in && st.out) {
      const n = diffDays(st.in, st.out);
      const livres = chales.filter(c => rangeFree(reservas[c.id], st.in, st.out)).length;
      note.textContent = `${fmtRange(st.in, st.out)}, ${plural(n, 'noite', 'noites')}. ${livres ? plural(livres, 'chalé livre', 'chalés livres') : 'Nenhum chalé livre nessas datas'}.`;
    } else note.textContent = 'Café da manhã incluso em todas as diárias.';
  }

  const link = c => {
    const p = new URLSearchParams({ c: c.slug });
    if (st.in && st.out) { p.set('in', iso(st.in)); p.set('out', iso(st.out)); }
    p.set('h', st.guests);
    return `chale.html?${p}`;
  };

  function availability(c) {
    const set = reservas[c.id];
    if (st.in && st.out) {
      if (rangeFree(set, st.in, st.out)) {
        const q = quote(c, st.in, st.out);
        return `<p class="avail">${icon('check', 'sm')}Livre de ${fmtRange(st.in, st.out)}. Total de ${brl(q.total)} no Pix.</p>`;
      }
      const alts = nextWeekends(set, 2);
      return `<p class="avail no">${icon('ban', 'sm')}Ocupado nessas datas</p>` +
        (alts.length ? `<span class="avail-alt">Fins de semana livres: ${alts.map(d => `<button type="button" data-pick="${iso(d)}">${fmtRange(d, addDays(d, 2))}</button>`).join(' ou ')}</span>` : '');
    }
    const w = nextWeekends(set, 1)[0];
    return w ? `<p class="avail">${icon('calendar', 'sm')}Próximo fim de semana livre: <button type="button" data-pick="${iso(w)}" style="font-weight:600;text-decoration:underline;text-underline-offset:3px">${fmtRange(w, addDays(w, 2))}</button></p>` : '';
  }

  function renderList() {
    $('#chalet-list').innerHTML = chales.map(c => {
      const [a, b, d] = [c.mosaico[0], c.mosaico[1], c.mosaico[3]];
      return `
      <article class="chalet">
        <a class="chalet-photos" href="${link(c)}" aria-label="Ver o ${esc(c.nome)}">
          <div>${img(c, a, '(max-width: 960px) 62vw, 440px')}</div>
          <div>${img(c, b, '(max-width: 960px) 34vw, 220px')}</div>
          <div>${img(c, d, '(max-width: 960px) 34vw, 220px')}</div>
        </a>
        <div class="chalet-body">
          <p class="chalet-place">${icon('pin', 'sm')}${esc(c.cidade)}, ${esc(c.estado)}</p>
          <h3>${esc(c.nome)}</h3>
          <p>${esc(c.resumo)}</p>
          <ul class="facts">
            <li>${icon('users')}${c.capacidade} hóspedes</li>
            <li>${icon('bed')}${esc(c.cama)}</li>
            <li>${icon('waves')}Hidromassagem</li>
            <li>${icon('star')}${EV.fmtNota(c.nota)} em ${c.totalAvaliacoes} avaliações</li>
          </ul>
          ${availability(c)}
          <div class="chalet-buy">
            <p class="from">Diárias a partir de<strong class="price">${brl(minRate(c))}</strong></p>
            <a class="btn btn-primary" href="${link(c)}">${st.in && st.out && rangeFree(reservas[c.id], st.in, st.out) ? 'Reservar estas datas' : 'Ver chalé e calendário'}</a>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  $('#chalet-list').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const [y, m, d] = b.dataset.pick.split('-').map(Number);
    st.in = new Date(y, m - 1, d); st.out = addDays(st.in, 2);
    picker.paint(); picker.cal.render(); renderNote(); renderList();
    EV.toast(`Datas selecionadas: ${fmtRange(st.in, st.out)}`);
  });

  $('#go').addEventListener('click', e => {
    e.stopPropagation();
    if (!st.in || !st.out) { picker.open(st.in ? 'out' : 'in'); return; }
    // Com datas escolhidas: se só um chalé está livre, vai direto para a página dele com as datas;
    // com mais de um livre (ou nenhum), mostra a lista para comparar ou ver alternativas.
    const livres = chales.filter(c => rangeFree(reservas[c.id], st.in, st.out));
    if (livres.length === 1) { location.href = link(livres[0]); return; }
    $('#chales').scrollIntoView({ behavior: 'smooth' });
  });
  $$('[data-focus-search], [data-open-search]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    $('#buscar').scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => picker.open('in'), 500);
  }));

  // estância e chamada final
  $('#estate-photos').innerHTML = `<div>${img(main, 'fogueira-externa', '(max-width: 960px) 66vw, 380px')}</div><div>${img(main, 'por-do-sol', '(max-width: 960px) 46vw, 260px')}</div>`;
  $('#closing-bg').innerHTML = img(main, 'hidromassagem-varanda', '(max-width: 760px) 100vw, 1120px', { alt: '' });

  // experiências
  $('#exps').innerHTML = pacotes.map(p => `
    <article class="exp">
      <div class="exp-photo">${p.foto ? pkgImg(p, '(max-width: 760px) 92vw, (max-width: 960px) 46vw, 360px', { alt: p.nome }) : icon(p.icone)}</div>
      <h3>${esc(p.nome)}<span class="price">${brl(p.preco)}</span></h3>
      <p>${esc(p.descricao)}</p>
    </article>`).join('');

  // avaliações (notas reais dos anúncios, somando os chalés)
  const nota = n => n.toFixed(1).replace('.', ',');
  const totalAv = chales.reduce((s, c) => s + c.totalAvaliacoes, 0);
  const media = chales.reduce((s, c) => s + c.nota * c.totalAvaliacoes, 0) / totalAv;
  const criterios = main.notas.map(n => ({
    criterio: n.criterio,
    nota: chales.reduce((s, c) => s + ((c.notas.find(x => x.criterio === n.criterio) || n).nota) * c.totalAvaliacoes, 0) / totalAv
  }));
  const titulo = chales.length > 1 ? 'Nota máxima de quem já ficou na estância' : `Nota máxima de quem já ficou no ${main.nome.replace('Chalé ', '')}`;
  $('#reviews').innerHTML = `
    <div>
      <h2 class="h2" id="rev-t">${esc(titulo)}</h2>
      <div class="score"><b>${nota(media)}</b><span><span class="stars" aria-label="5 de 5 estrelas">${icon('star').repeat(5)}</span><br>${totalAv} avaliações no Airbnb${chales.length > 1 ? `, nos ${chales.length} chalés` : ''}</span></div>
      <div class="host"><span class="avatar" aria-hidden="true">NL</span><div><b>${esc(main.anfitriao.nome)}, seu anfitrião</b><p>Superhost há ${main.anfitriao.anos} anos, ${main.anfitriao.avaliacoes} avaliações e nota ${String(main.anfitriao.nota).replace('.', ',')}</p></div></div>
    </div>
    <div class="bars">${criterios.map(n => `<div class="bar"><span>${esc(n.criterio)}</span><div class="bar-t"><i style="width:${(n.nota / 5) * 100}%"></i></div><b>${nota(n.nota)}</b></div>`).join('')}</div>`;

  renderList(); renderNote();

  // Vindo de outra página (ex.: chale.html → index.html#estancia), o conteúdo carrega depois do salto
  // e empurra a seção para baixo. Reposiciona quando tudo terminou de montar.
  if (location.hash && location.hash.length > 1) {
    const alvo = document.getElementById(location.hash.slice(1));
    if (alvo) requestAnimationFrame(() => alvo.scrollIntoView({ behavior: 'instant', block: 'start' }));
  }
})();

/* Folhas caindo no topo da home (desligado com "reduzir movimento") */
(() => {
  const box = document.querySelector('.hero .leaves');
  if (!box || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colors = ['#7FA35B', '#A9C47F', '#C9A24A', '#8DAA62', '#B9873B', '#6E8F4C'];
  const shapes = [
    'M12 2C6 6 4 12 6 18c2 3 5 4 6 4s4-1 6-4c2-6 0-12-6-16Z',
    'M12 2c-4 3-7 8-6 13 1 4 4 7 6 7s5-3 6-7c1-5-2-10-6-13Z',
    'M3 21C3 10 10 3 21 3c0 11-7 18-18 18Z'
  ];
  const n = innerWidth < 760 ? 7 : 13;
  let h = '';
  for (let i = 0; i < n; i++) {
    const size = 12 + Math.random() * 16, dur = 13 + Math.random() * 14, delay = -Math.random() * dur;
    const c = colors[i % colors.length], sh = shapes[i % shapes.length];
    h += `<span class="leaf" style="left:${Math.random() * 105}%;width:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;opacity:${.55 + Math.random() * .4}">
      <i style="animation-duration:${2.2 + Math.random() * 2.4}s;animation-delay:${-Math.random() * 3}s"><svg viewBox="0 0 24 24"><path d="${sh}" fill="${c}"/><path d="M12 4v17" stroke="rgba(0,0,0,.18)" stroke-width="1" fill="none"/></svg></i></span>`;
  }
  box.innerHTML = h;
})();


/* Hero: fotos em crossfade (ou vídeo), parallax e indicadores */
(() => {
  const hero = document.querySelector('.hero'); if (!hero) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const box = hero.querySelector('.hero-slides');
  const ctrl = hero.querySelector('.hero-ctrl');
  const DUR = 6500;

  // vídeo opcional em loop
  if (hero.dataset.video) {
    box.innerHTML = `<video autoplay muted loop playsinline preload="auto" aria-hidden="true" src="${hero.dataset.video}"></video>`;
    ctrl.remove();
  } else {
    const slides = [...box.querySelectorAll('.hero-slide')];
    const dots = ctrl.querySelector('.hero-dots'), cap = ctrl.querySelector('.hero-caption'), pauseBtn = ctrl.querySelector('.hero-pause');
    dots.innerHTML = slides.map((s, i) => `<button type="button" aria-label="Foto ${i + 1}: ${s.dataset.caption}"><i></i></button>`).join('');
    dots.style.setProperty('--dur', DUR + 'ms');
    const btns = [...dots.children];
    let idx = 0, timer = null, paused = reduce;
    const show = n => {
      const prev = idx; idx = (n + slides.length) % slides.length;
      slides.forEach((s, i) => {
        s.classList.toggle('is-active', i === idx);
        s.classList.toggle('was-active', i === prev && prev !== idx);
        s.setAttribute('aria-hidden', i !== idx);
      });
      btns.forEach((b, i) => {
        b.classList.toggle('done', i < idx);
        b.removeAttribute('aria-current');
        if (i === idx) { void b.offsetWidth; b.setAttribute('aria-current', 'true'); }
      });
      cap.textContent = slides[idx].dataset.caption;
      schedule();
    };
    const schedule = () => { clearTimeout(timer); if (!paused) timer = setTimeout(() => show(idx + 1), DUR); };
    const setPaused = p => {
      paused = p; ctrl.classList.toggle('paused', p);
      pauseBtn.setAttribute('aria-label', p ? 'Continuar fotos' : 'Pausar fotos');
      pauseBtn.querySelector('use').setAttribute('href', p ? '#i-play' : '#i-pause');
      schedule();
    };
    btns.forEach((b, i) => b.addEventListener('click', () => show(i)));
    pauseBtn.addEventListener('click', () => setPaused(!paused));
    document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else schedule(); });
    setPaused(paused); show(0);
  }

  // parallax: o fundo anda mais devagar que a página
  if (!reduce) {
    let ticking = false;
    const move = () => {
      const y = scrollY;
      if (y < hero.offsetHeight) box.style.transform = `translate3d(0, ${y * 0.35}px, 0)`;
      ticking = false;
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(move); } }, { passive: true });
    move();
  }
})();

/* Menu acompanha a seção visível */
(() => {
  const links = [...document.querySelectorAll('.nav a')];
  const map = new Map(links.map(a => [a.getAttribute('href').split('#')[1], a]));
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    links.forEach(a => a.removeAttribute('aria-current'));
    const a = map.get(e.target.id); if (a) a.setAttribute('aria-current', 'true');
  }), { rootMargin: '-45% 0px -50% 0px' });
  ['inicio', 'chales', 'estancia', 'experiencias', 'avaliacoes', 'como-chegar'].forEach(id => { const el = document.getElementById(id); el && io.observe(el); });
  const hero = document.querySelector('.hero');
  if (hero) { hero.id = hero.id || 'inicio'; io.observe(hero); }
})();

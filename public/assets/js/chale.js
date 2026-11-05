(async () => {
  const { $, $$, icon, esc, api, img, pkgImg, brl, fmtRange, fmtShort, fmtDate, plural, diffDays, addDays, iso, parse, today, qs,
    bookedSet, rangeFree, quote, minRate, Calendar, stayPicker, lightbox } = EV;

  const slug = qs.get('c') || (await api.chales())[0].slug;
  const c = await api.chale(slug);
  if (!c) {
    $('main').innerHTML = `<div class="empty"><h1 class="h2">Não encontramos esse chalé</h1><p>O endereço pode estar incompleto. <a class="link" href="index.html#chales">Ver todos os chalés</a></p></div>`;
    $('#mbar').remove(); return;
  }
  const [pacotes, reservas] = await Promise.all([api.pacotes(), api.reservas(c.id)]);
  const booked = bookedSet(reservas);
  const min = c.tarifas.minNoites;
  document.title = `${c.nome} · Estância Verdejante`;

  // estado vindo da URL (só aceita se as datas forem válidas e livres)
  const st = { in: parse(qs.get('in')), out: parse(qs.get('out')), guests: Math.min(c.capacidade, Math.max(1, +qs.get('h') || 2)) };
  if (!(st.in && st.out && st.in >= today() && diffDays(st.in, st.out) >= min && rangeFree(booked, st.in, st.out))) { st.in = st.out = null; }

  /* ---------- Cabeçalho do chalé ---------- */
  $$('[data-name]').forEach(e => e.textContent = c.nome);
  const n1 = v => v.toFixed(1).replace('.', ',');
  $('#meta').innerHTML = `
    <span>${icon('pin', 'sm')}${esc(c.cidade)}, ${esc(c.estado)}</span>
    <span><span class="stars" aria-hidden="true">${icon('star')}</span><strong>${EV.fmtNota(c.nota)}</strong><a class="link" href="#avaliacoes" style="font-weight:500">${c.totalAvaliacoes} avaliações</a></span>
    ${c.favorito ? `<span>${icon('award', 'sm')}Favorito dos hóspedes</span>` : ''}`;

  const lb = lightbox(c);
  $('#mosaic').innerHTML = c.mosaico.map((f, i) =>
    `<button type="button" data-f="${f}" aria-label="Ampliar foto ${i + 1}">${img(c, f, i ? '(max-width: 760px) 50vw, 300px' : '(max-width: 760px) 100vw, 600px', { eager: i === 0 })}</button>`).join('') +
    `<button type="button" class="all" data-f="">${icon('images', 'sm')}Ver as ${c.fotos.length} fotos</button>`;
  $('#mosaic').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) lb.open('Todas', b.dataset.f || undefined); });

  /* ---------- Sobre ---------- */
  $('#facts').innerHTML = `
    <li>${icon('users')}${c.capacidade} hóspedes</li><li>${icon('bed')}${esc(c.cama)}</li>
    <li>${icon('bath')}${plural(c.banheiros, 'banheiro', 'banheiros')}</li><li>${icon('coffee')}Café da manhã incluso</li>`;
  $('#desc').innerHTML = c.descricao.map(p => `<p>${esc(p)}</p>`).join('');
  $('#highlights').innerHTML = c.destaques.map(d => `<li><span class="badge-ico">${icon(d.icone)}</span><div><b>${esc(d.titulo)}</b><p>${esc(d.texto)}</p></div></li>`).join('');

  /* ---------- Comodidades ---------- */
  const allItems = c.comodidades.flatMap(g => g.itens);
  const li = i => `<li>${icon(i.icone)}<span>${esc(i.nome)}${i.detalhe ? `<small>${esc(i.detalhe)}</small>` : ''}</span></li>`;
  $('#amen-top').innerHTML = allItems.slice(0, 10).map(li).join('');
  $('#amen-all').innerHTML = c.comodidades.map(g => `<div class="amen-group"><h4>${esc(g.grupo)}</h4><ul class="amen">${g.itens.map(li).join('')}</ul></div>`).join('') +
    `<div class="amen-group"><h4>Não incluso</h4><ul class="amen amen-no">${c.naoIncluso.map(n => `<li>${icon('x')}<span>${esc(n)}</span></li>`).join('')}</ul></div>`;
  const tg = $('#amen-toggle'), more = $('#amen-more');
  const setT = o => { tg.setAttribute('aria-expanded', o); more.classList.toggle('open', o); $('#amen-top').hidden = o; tg.textContent = o ? 'Mostrar menos' : `Mostrar todas as comodidades`; };
  tg.addEventListener('click', () => setT(tg.getAttribute('aria-expanded') !== 'true')); setT(false);

  /* ---------- Pacotes ---------- */
  const mine = pacotes.filter(p => c.pacotesIds.includes(p.id));
  $('#packs').innerHTML = mine.map(p => `<li><span class="pack-th">${p.foto ? pkgImg(p, '72px') : icon(p.icone, 'lg')}</span><div><b>${esc(p.nome)}</b><p>${esc(p.descricao)}</p></div><span class="price">${brl(p.preco)}</span></li>`).join('');

  /* ---------- Avaliações ---------- */
  $('#rev').innerHTML = `
    <div><div class="score" style="margin-top:0"><b style="font-size:64px">${EV.fmtNota(c.nota)}</b><span><span class="stars" aria-label="5 de 5 estrelas">${icon('star').repeat(5)}</span><br>${c.totalAvaliacoes} avaliações no Airbnb</span></div>
      <div class="host" style="margin-top:24px;padding-top:22px"><span class="avatar" aria-hidden="true">${esc(c.anfitriao.nome.split(' ').map(x => x[0]).join(''))}</span><div><b>${esc(c.anfitriao.nome)}</b><p>Superhost há ${c.anfitriao.anos} anos. Fala ${esc(c.anfitriao.idiomas.toLowerCase())}.</p></div></div></div>
    <div class="bars">${c.notas.map(x => `<div class="bar"><span>${esc(x.criterio)}</span><div class="bar-t"><i style="width:${x.nota / 5 * 100}%"></i></div><b>${n1(x.nota)}</b></div>`).join('')}</div>`;

  /* ---------- Regras ---------- */
  $('#rules').innerHTML = `
    <div><h4>Chegada e saída</h4><ul><li>Check-in a partir das ${c.regras.checkin}</li><li>Check-out até ${c.regras.checkout}</li><li>Self check-in com apoio da equipe</li></ul></div>
    <div><h4>Regras da casa</h4><ul>${c.regras.itens.map(r => `<li>${esc(r)}</li>`).join('')}</ul></div>
    <div><h4>Cancelamento</h4><ul><li>Grátis até ${c.cancelamento.diasGratis} dias antes do check-in</li><li>Depois disso, reembolso de ${c.cancelamento.percentualDepois}% das diárias</li><li>Mínimo de ${plural(min, 'noite', 'noites')} por reserva</li></ul></div>`;

  /* ---------- Local ---------- */
  const L = c.localizacao;
  $('#loc-txt').textContent = `${L.texto}. Perto de ${L.proximos.map(p => p.nome).join(', ').replace(/, ([^,]*)$/, ' e $1')}.`;
  $('#map').src = `https://www.openstreetmap.org/export/embed.html?bbox=${L.lng - .035}%2C${L.lat - .022}%2C${L.lng + .035}%2C${L.lat + .022}&layer=mapnik&marker=${L.lat}%2C${L.lng}`;

  /* ---------- Reserva: calendário + card ---------- */
  const inlineHint = $('#inline-hint');
  const inline = new Calendar($('#cal-inline'), {
    state: st, months: innerWidth < 760 ? 1 : 2, prices: true, chale: c, booked, minNights: min,
    onHint: t => { inlineHint.textContent = t; inlineHint.classList.add('warn'); },
    onChange: () => { picker.paint(); picker.cal.render(); update(); }
  });
  const picker = stayPicker({
    state: st, fieldIn: $('#b-in'), fieldOut: $('#b-out'), fieldG: $('#b-g'), popCal: $('#b-pop-cal'), popG: $('#b-pop-g'),
    months: 1, booked, chale: c, prices: false, minNights: min, maxGuests: c.capacidade,
    onChange: () => { inline.render(); update(); }
  });
  // o campo de hóspedes do card usa um layout diferente (rótulo + valor + seta)
  const gVal = () => { $('#b-g .pf-v').textContent = st.guests === 1 ? '1 adulto' : `${st.guests} adultos`; };

  const checkoutUrl = () => `checkout.html?${new URLSearchParams({ c: c.slug, in: iso(st.in), out: iso(st.out), h: st.guests })}`;

  function update() {
    gVal();
    const has = st.in && st.out;
    const q = has ? quote(c, st.in, st.out) : null;
    // URL compartilhável
    const p = new URLSearchParams({ c: c.slug }); if (has) { p.set('in', iso(st.in)); p.set('out', iso(st.out)); } p.set('h', st.guests);
    history.replaceState(null, '', `?${p}`);

    $('#book-price').innerHTML = has
      ? `<strong class="price">${brl(q.total)}</strong><span>total no Pix, ${plural(q.noites.length, 'noite', 'noites')}</span>`
      : `<strong class="price">${brl(minRate(c))}</strong><span>por noite, a partir de</span>`;
    const go = $('#b-go');
    if (has) { go.textContent = 'Reservar'; go.href = checkoutUrl(); }
    else { go.textContent = st.in ? 'Escolher check-out' : 'Escolher datas'; go.href = '#'; }
    $('#b-lines').innerHTML = has ? lines(q) : '';
    $('#b-hint').textContent = has ? 'Nada é cobrado nesta etapa.' : `Mínimo de ${plural(min, 'noite', 'noites')}. Café da manhã incluso.`;

    if (!st.in) { inlineHint.textContent = 'Toque no dia de chegada.'; inlineHint.classList.remove('warn'); }
    else if (!st.out) { inlineHint.textContent = `Chegada em ${fmtDate(st.in)}. Agora toque no dia de saída.`; inlineHint.classList.remove('warn'); }
    else { inlineHint.textContent = ''; }
    const sum = $('#avail-sum');
    sum.hidden = !has;
    if (has) sum.innerHTML = `<span><b>${fmtRange(st.in, st.out)}</b><br><span class="muted">${plural(q.noites.length, 'noite', 'noites')}, ${brl(q.total)} no Pix</span></span><a class="btn btn-primary" href="${checkoutUrl()}">Reservar estas datas</a>`;

    $('#m-price').textContent = has ? brl(q.total) : `${brl(minRate(c))} / noite`;
    $('#m-sub').textContent = has ? fmtRange(st.in, st.out) : 'Café da manhã incluso';
    const mg = $('#m-go'); mg.textContent = has ? 'Reservar' : 'Escolher datas'; mg.href = has ? checkoutUrl() : '#disponibilidade';
  }
  function lines(q) {
    return q.grupos.map(g => `<div class="line"><span>${brl(g.valor)} × ${plural(g.qtd, 'noite', 'noites')}</span><span class="price">${brl(g.valor * g.qtd)}</span></div>`).join('') +
      `<div class="line"><span>Taxa de limpeza</span><span class="price">${brl(q.limpeza)}</span></div>` +
      `<div class="line disc"><span>Desconto no Pix (${c.pagamento.descontoPix}%)</span><span class="price">−${brl(q.descPix, 2)}</span></div>` +
      `<div class="line total"><span>Total</span><span class="price">${brl(q.total, 2)}</span></div>`;
  }
  $('#b-go').addEventListener('click', e => { if (!(st.in && st.out)) { e.preventDefault(); e.stopPropagation(); picker.open(st.in ? 'out' : 'in'); } });
  $('#m-go').addEventListener('click', e => { if (!(st.in && st.out)) { e.preventDefault(); $('#disponibilidade').scrollIntoView({ behavior: 'smooth' }); } });

  if (st.in) inline.goTo(st.in);
  picker.paint(); update();
})();

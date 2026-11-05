(async () => {
  const { $, $$, icon, esc, api, img, pkgImg, brl, fmtRange, fmtShort, fmtLong, plural, diffDays, addDays, iso, parse, today, qs,
    bookedSet, rangeFree, quote, stayPicker, toast, DOW, MON } = EV;

  const chales = await api.chales();
  const c = await api.chale(qs.get('c') || chales[0].slug);
  if (!c) { $('main').innerHTML = `<div class="empty" style="grid-column:1/-1"><h1 class="h2">Não encontramos esse chalé</h1><p><a class="link" href="index.html#chales">Ver os chalés</a></p></div>`; return; }
  const [pacotesAll, reservas] = await Promise.all([api.pacotes(), api.reservas(c.id)]);
  let booked = bookedSet(reservas);
  const pacotes = pacotesAll.filter(p => c.pacotesIds.includes(p.id));
  const min = c.tarifas.minNoites;
  $('#back').href = `chale.html?c=${c.slug}`;
  $('#back').lastChild.textContent = `Voltar para o ${c.nome}`;

  /* ---------- Estado ---------- */
  const st = { in: parse(qs.get('in')), out: parse(qs.get('out')), guests: Math.min(c.capacidade, Math.max(1, +qs.get('h') || 2)) };
  const f = { ocasiao: null, pacotes: new Set(), chegada: null, metodo: 'pix', parcelas: 1, cupom: null };
  const validStay = () => st.in && st.out && st.in >= today() && diffDays(st.in, st.out) >= min && rangeFree(booked, st.in, st.out);
  if (!validStay()) { st.in = st.out = null; }
  let step = 0;
  const steps = $$('.step');

  /* ---------- Passo 1: estadia ---------- */
  const stayMsg = $('#stay-msg');
  const picker = stayPicker({
    state: st, fieldIn: $('#c-in'), fieldOut: $('#c-out'), fieldG: $('#c-g'), popCal: $('#c-pop-cal'), popG: $('#c-pop-g'),
    months: 2, booked, chale: c, prices: true, minNights: min, maxGuests: c.capacidade,
    onChange: () => { stayMsg.textContent = ''; render(); }
  });
  $('#c-pop-cal .cal-host').classList.add('with-prices');
  $('#c-pop-cal').style.width = 'min(700px, calc(100vw - 40px))';

  const OCC = ['Aniversário', 'Aniversário de namoro ou casamento', 'Pedido de casamento', 'Lua de mel', 'Só descansar'];
  $('#occasions').innerHTML = OCC.map(o => `<button type="button" class="chip" role="radio" aria-checked="false" data-o="${esc(o)}">${esc(o)}</button>`).join('');
  $('#occasions').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    f.ocasiao = f.ocasiao === b.dataset.o ? null : b.dataset.o;
    $$('.chip', $('#occasions')).forEach(x => x.setAttribute('aria-checked', x.dataset.o === f.ocasiao));
    // sugere decoração para datas românticas
    if (f.ocasiao && f.ocasiao !== 'Só descansar' && !f.pacotes.size) toast('Dica: a decoração romântica deixa tudo pronto na chegada.');
  });

  $('#addons').innerHTML = pacotes.map(p => `
    <label class="addon">
      <input type="checkbox" value="${p.id}">
      <span class="pack-th">${p.foto ? pkgImg(p, '56px') : icon(p.icone)}</span>
      <span><b>${esc(p.nome)}</b><small>${esc(p.descricao)}</small></span>
      <span class="addon-r"><span class="price">${brl(p.preco)}</span><span class="tick">${icon('check')}</span></span>
    </label>`).join('');
  $('#addons').addEventListener('change', e => {
    const id = +e.target.value; e.target.checked ? f.pacotes.add(id) : f.pacotes.delete(id); render();
  });

  /* ---------- Passo 2: dados ---------- */
  const ARR = ['14h às 16h', '16h às 18h', '18h às 20h', 'Depois das 20h'];
  $('#arrival').innerHTML = ARR.map(a => `<button type="button" class="chip" role="radio" aria-checked="false" data-a="${a}">${a}</button>`).join('');
  $('#arrival').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    f.chegada = b.dataset.a; $('#arr-msg').textContent = '';
    $$('.chip', $('#arrival')).forEach(x => x.setAttribute('aria-checked', x === b));
  });

  const digits = s => s.replace(/\D/g, '');
  const mask = {
    cel: v => { const d = digits(v).slice(0, 11); if (d.length <= 2) return d.length ? `(${d}` : ''; if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`; if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`; return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`; },
    cpf: v => { const d = digits(v).slice(0, 11); return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); },
    'cc-num': v => { const d = digits(v).slice(0, 19); return /^3[47]/.test(d) ? d.slice(0, 15).replace(/^(\d{4})(\d{0,6})(\d{0,5}).*/, (m, a, b, c2) => [a, b, c2].filter(Boolean).join(' ')) : d.replace(/(\d{4})(?=\d)/g, '$1 '); },
    'cc-exp': v => { const d = digits(v).slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; },
    'cc-cvv': v => digits(v).slice(0, 4)
  };
  Object.keys(mask).forEach(id => $('#' + id).addEventListener('input', e => {
    const el = e.target, end = el.selectionStart === el.value.length;
    el.value = mask[id](el.value);
    if (end) el.selectionStart = el.selectionEnd = el.value.length;
    clearErr(el);
    if (id === 'cc-num') $('#cc-brand').textContent = brand(el.value);
  }));
  $$('#f-dados .inp, #f-card .inp').forEach(el => {
    el.addEventListener('blur', () => { if (el.value) check(el); });
    el.addEventListener('input', () => clearErr(el));
  });

  const cpfOk = v => {
    const d = digits(v); if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
    const calc = n => { let s = 0; for (let i = 0; i < n; i++) s += +d[i] * (n + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    return calc(9) === +d[9] && calc(10) === +d[10];
  };
  const luhn = v => { const d = digits(v); if (d.length < 13) return false; let s = 0; for (let i = 0; i < d.length; i++) { let n = +d[d.length - 1 - i]; if (i % 2) { n *= 2; if (n > 9) n -= 9; } s += n; } return s % 10 === 0; };
  function brand(v) {
    const d = digits(v);
    if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(d)) return 'ELO';
    if (/^(606282|3841)/.test(d)) return 'HIPERCARD';
    if (/^4/.test(d)) return 'VISA';
    if (/^(5[1-5]|2[2-7])/.test(d)) return 'MASTERCARD';
    if (/^3[47]/.test(d)) return 'AMEX';
    return '';
  }
  const RULES = {
    nome: v => v.trim().split(/\s+/).length >= 2 || 'Digite nome e sobrenome.',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || 'Digite um e-mail válido, como voce@email.com.',
    cel: v => digits(v).length >= 10 || 'Digite o celular com DDD.',
    cpf: v => cpfOk(v) || 'Esse CPF não é válido. Confira os números.',
    'cc-num': v => luhn(v) || 'Confira o número do cartão.',
    'cc-name': v => v.trim().length >= 3 || 'Digite o nome como aparece no cartão.',
    'cc-exp': v => { const [m, y] = v.split('/').map(Number); if (!m || m > 12 || !y) return 'Use o formato MM/AA.'; const exp = new Date(2000 + y, m, 0); return exp >= today() || 'Esse cartão está vencido.'; },
    'cc-cvv': v => digits(v).length >= 3 || 'O código tem 3 ou 4 dígitos, no verso do cartão.'
  };
  function check(el) {
    const r = RULES[el.id]; if (!r) return true;
    const ok = r(el.value);
    const fld = el.closest('.fld');
    fld.classList.toggle('err', ok !== true);
    $('.msg', fld).textContent = ok === true ? '' : ok;
    el.setAttribute('aria-invalid', ok !== true);
    return ok === true;
  }
  function clearErr(el) { const fld = el.closest('.fld'); if (fld && fld.classList.contains('err')) { fld.classList.remove('err'); $('.msg', fld).textContent = ''; el.removeAttribute('aria-invalid'); } }

  /* ---------- Passo 3: pagamento ---------- */
  $('[data-pix-off]').textContent = `${c.pagamento.descontoPix}% de desconto, aprovação na hora`;
  $('[data-inst-off]').textContent = `Em até ${c.pagamento.parcelasSemJuros}x sem juros`;
  $$('.paytab').forEach(t => t.addEventListener('click', () => {
    f.metodo = t.dataset.m;
    $$('.paytab').forEach(x => x.setAttribute('aria-checked', x === t));
    $('#pay-pix').hidden = f.metodo !== 'pix'; $('#pay-card').hidden = f.metodo !== 'cartao';
    hideErr(); render();
  }));
  $('#installments').addEventListener('click', e => {
    const b = e.target.closest('.inst'); if (!b) return;
    f.parcelas = +b.dataset.p; render();
  });
  $$('[data-test]').forEach(b => b.addEventListener('click', () => {
    const n = $('#cc-num'); n.value = mask['cc-num'](b.dataset.test); $('#cc-brand').textContent = brand(n.value); clearErr(n);
    if (!$('#cc-name').value) $('#cc-name').value = ($('#nome').value || 'Cliente Teste').toUpperCase();
    if (!$('#cc-exp').value) $('#cc-exp').value = '12/29';
    if (!$('#cc-cvv').value) $('#cc-cvv').value = '123';
    $$('#f-card .inp').forEach(clearErr);
  }));
  $('#agree').addEventListener('change', hideErr);
  $('#see-policy').addEventListener('click', e => { e.preventDefault(); toast(`Cancelamento grátis até ${c.cancelamento.diasGratis} dias antes do check-in. Depois, reembolso de ${c.cancelamento.percentualDepois}% das diárias.`); });

  /* ---------- Cupom ---------- */
  async function applyCoupon(code) {
    const msg = $('.coupon-msg');
    if (!code.trim()) { f.cupom = null; render(); return; }
    const cp = await api.cupom(code);
    if (!cp) { f.cupom = null; render(); $('.coupon-msg').className = 'coupon-msg bad'; $('.coupon-msg').textContent = 'Cupom não encontrado. Confira as letras e tente de novo.'; return; }
    f.cupom = cp; render(); toast(`Cupom ${cp.codigo} aplicado`);
  }

  /* ---------- Resumo ---------- */
  let q = null;
  function render() {
    const has = st.in && st.out;
    const chosen = pacotes.filter(p => f.pacotes.has(p.id));
    q = has ? quote(c, st.in, st.out, { pacotes: chosen, cupom: f.cupom, metodo: f.metodo }) : null;

    // resumo dos passos
    $('#s1 [data-sum]').textContent = has ? `${fmtRange(st.in, st.out)}, ${st.guests === 1 ? '1 adulto' : st.guests + ' adultos'}${chosen.length ? `, ${plural(chosen.length, 'experiência', 'experiências')}` : ''}` : 'Escolha as datas da viagem';
    if (step > 1) $('#s2 [data-sum]').textContent = `${$('#nome').value.trim()}, ${$('#email').value.trim()}`;

    // parcelas
    if (q) {
      const max = c.pagamento.parcelasSemJuros;
      const base = quote(c, st.in, st.out, { pacotes: chosen, cupom: f.cupom, metodo: 'cartao' }).total;
      if (f.parcelas > max) f.parcelas = 1;
      $('#installments').innerHTML = Array.from({ length: max }, (_, i) => i + 1).map(n =>
        `<button type="button" class="inst" role="radio" data-p="${n}" aria-checked="${n === f.parcelas}"><span>${n}x de ${brl(base / n, 2)}</span><span>${n === 1 ? 'à vista' : 'sem juros'}</span></button>`).join('');
    }
    $('#pay').innerHTML = !q ? 'Escolha as datas' : f.metodo === 'pix'
      ? `${icon('lock', 'sm')}Confirmar e gerar Pix de ${brl(q.total, 2)}`
      : `${icon('lock', 'sm')}Pagar ${f.parcelas > 1 ? `${f.parcelas}x de ${brl(q.total / f.parcelas, 2)}` : brl(q.total, 2)}`;

    const ph = c.fotos.find(p => p.arquivo === c.capa);
    $('#sum-body').innerHTML = `
      <div class="sum-top"><div class="ph">${img(c, c.capa, '96px', { alt: '' })}</div><div><b>${esc(c.nome)}</b><p>${icon('star', 'sm')}${EV.fmtNota(c.nota)} · ${c.totalAvaliacoes} avaliações</p></div></div>
      <div class="sum-sec">
        <div class="sum-dates">
          <div><span>Check-in</span><b>${has ? `${DOW[st.in.getDay()].slice(0, 3)}, ${fmtShort(st.in)}` : '—'}</b><span>a partir das ${c.regras.checkin}</span></div>
          <div><span>Check-out</span><b>${has ? `${DOW[st.out.getDay()].slice(0, 3)}, ${fmtShort(st.out)}` : '—'}</b><span>até ${c.regras.checkout}</span></div>
        </div>
        <p class="small muted" style="margin-top:12px">${st.guests === 1 ? '1 adulto' : `${st.guests} adultos`}${has ? `, ${plural(q.noites.length, 'noite', 'noites')}` : ''}. Café da manhã incluso.</p>
      </div>
      ${q ? `<div class="sum-sec"><div class="lines">
        ${q.grupos.map(g => `<div class="line"><span>${brl(g.valor)} × ${plural(g.qtd, 'noite', 'noites')}<small>${esc(g.label)}</small></span><span class="price">${brl(g.valor * g.qtd)}</span></div>`).join('')}
        <div class="line"><span>Taxa de limpeza</span><span class="price">${brl(q.limpeza)}</span></div>
        ${chosen.map(p => `<div class="line"><span>${esc(p.nome)}</span><span class="price">${brl(p.preco)}</span></div>`).join('')}
        ${q.descCupom ? `<div class="line disc"><span>Cupom ${esc(f.cupom.codigo)} (${f.cupom.percentual}% nas diárias)</span><span class="price">−${brl(q.descCupom, 2)}</span></div>` : ''}
        ${q.descPix ? `<div class="line disc"><span>Desconto no Pix (${c.pagamento.descontoPix}%)</span><span class="price">−${brl(q.descPix, 2)}</span></div>` : ''}
        <div class="line total"><span>Total</span><span class="price">${brl(q.total, 2)}</span></div>
        ${f.metodo === 'cartao' && f.parcelas > 1 ? `<p class="inst-hint">${f.parcelas}x de ${brl(q.total / f.parcelas, 2)} sem juros</p>` : ''}
      </div></div>` : `<div class="sum-sec"><p class="muted small">Escolha as datas para ver o valor total.</p></div>`}
      <div class="sum-sec">
        <form class="coupon" id="coupon-f"><label class="sr-only" for="coupon">Cupom de desconto</label><input class="inp" id="coupon" placeholder="Cupom de desconto" value="${f.cupom ? esc(f.cupom.codigo) : ''}" autocomplete="off"><button class="btn btn-line" type="submit">${f.cupom ? 'Remover' : 'Aplicar'}</button></form>
        <p class="coupon-msg ${f.cupom ? 'ok' : ''}">${f.cupom ? esc(f.cupom.descricao) : 'Teste com BEMVINDO10'}</p>
      </div>
      <div class="sum-sec"><p class="policy">${icon('shield')}<span>${has ? `Cancelamento grátis até ${fmtShort(addDays(st.in, -c.cancelamento.diasGratis))}. Depois, reembolso de ${c.cancelamento.percentualDepois}% das diárias.` : `Cancelamento grátis até ${c.cancelamento.diasGratis} dias antes do check-in.`}</span></p></div>`;
    $('[data-total-m]').textContent = q ? brl(q.total, 2) : '';
    $('#coupon-f').addEventListener('submit', e => {
      e.preventDefault();
      if (f.cupom) { f.cupom = null; render(); return; }
      applyCoupon($('#coupon').value);
    });
  }
  $('.sum-toggle').addEventListener('click', e => {
    const s = $('#summary'), o = !s.classList.contains('open');
    s.classList.toggle('open', o); e.currentTarget.setAttribute('aria-expanded', o);
  });

  /* ---------- Navegação entre passos ---------- */
  function validate(i) {
    if (i === 0) {
      if (!st.in || !st.out) { stayMsg.textContent = 'Escolha as datas de check-in e check-out para continuar.'; picker.open(st.in ? 'out' : 'in'); return false; }
      if (!rangeFree(booked, st.in, st.out)) { stayMsg.textContent = 'Essas datas acabaram de ser reservadas. Escolha outras.'; return false; }
      return true;
    }
    if (i === 1) {
      const els = ['nome', 'email', 'cel', 'cpf'].map(id => $('#' + id));
      const bad = els.filter(el => !check(el));
      if (!f.chegada) $('#arr-msg').textContent = 'Escolha um horário aproximado; ajuda a equipe a receber vocês.';
      if (bad.length) { bad[0].focus(); return false; }
      return !!f.chegada;
    }
    return true;
  }
  function go(i) {
    step = i;
    steps.forEach((s, j) => { s.classList.toggle('active', j === i); s.classList.toggle('done', j < i); });
    render();
    const target = steps[i];
    setTimeout(() => {
      const top = target.getBoundingClientRect().top + scrollY - 90;
      scrollTo({ top, behavior: 'smooth' });
      const first = $('.inp, .chip, .paytab', target); if (i > 0 && first && innerWidth > 760) first.focus({ preventScroll: true });
    }, 30);
  }
  $$('[data-next]').forEach(b => b.addEventListener('click', () => { const from = +b.dataset.next - 1; if (validate(from)) go(+b.dataset.next); }));
  $$('[data-edit]').forEach(b => b.addEventListener('click', () => go(+b.dataset.edit)));

  /* ---------- Confirmar ---------- */
  const err = $('#pay-err');
  const showErr = t => { $('span', err).textContent = t; err.classList.add('show'); };
  function hideErr() { err.classList.remove('show'); }
  const code = () => 'EV-' + Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');

  $('#pay').addEventListener('click', async () => {
    hideErr();
    if (!validate(0)) { go(0); return; }
    if (!validate(1)) { go(1); return; }
    if (f.metodo === 'cartao') {
      const bad = ['cc-num', 'cc-name', 'cc-exp', 'cc-cvv'].map(id => $('#' + id)).filter(el => !check(el));
      if (bad.length) { bad[0].focus(); return; }
    }
    if (!$('#agree').checked) { showErr('Para continuar, confirme que leu a política de cancelamento e as regras da casa.'); $('#agree').focus(); return; }

    const btn = $('#pay'); const label = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = `<span class="spinner" aria-hidden="true"></span>${f.metodo === 'pix' ? 'Gerando o Pix…' : 'Processando pagamento…'}`;
    try {
      await new Promise(r => setTimeout(r, 1400));
      // confere de novo se ninguém reservou as mesmas noites nesse meio-tempo
      booked = bookedSet(await api.reservas(c.id));
      if (!rangeFree(booked, st.in, st.out)) { picker.setBooked(booked); throw new Error('Essas datas acabaram de ser reservadas por outra pessoa. Volte ao passo 1 e escolha outras.'); }
      const num = digits($('#cc-num').value);
      if (f.metodo === 'cartao' && num === '4000000000000002') throw new Error('O banco emissor recusou o pagamento. Tente outro cartão ou pague com Pix.');

      const chosen = pacotes.filter(p => f.pacotes.has(p.id));
      const agora = new Date();
      const r = await api.criarReserva({
        codigo: code(), chaleId: c.id, checkin: iso(st.in), checkout: iso(st.out), hospedes: st.guests,
        status: f.metodo === 'pix' ? 'aguardando-pagamento' : 'confirmada', origem: 'site',
        hospede: { nome: $('#nome').value.trim(), email: $('#email').value.trim(), celular: $('#cel').value, cpf: $('#cpf').value.replace(/^(\d{3})\.\d{3}\.\d{3}/, '$1.***.***'), acompanhante: $('#hospede2').value.trim() },
        chegada: f.chegada, ocasiao: f.ocasiao, observacoes: $('#obs').value.trim(),
        pacotes: chosen.map(p => ({ id: p.id, nome: p.nome, preco: p.preco })),
        cupom: f.cupom ? f.cupom.codigo : null,
        pagamento: f.metodo === 'pix'
          ? { metodo: 'pix', expiraEm: new Date(agora.getTime() + 30 * 60000).toISOString() }
          : { metodo: 'cartao', parcelas: f.parcelas, bandeira: brand(num) || 'CARTÃO', final: num.slice(-4), aprovadoEm: agora.toISOString() },
        valores: { grupos: q.grupos, hospedagem: q.hospedagem, limpeza: q.limpeza, extras: q.extras, descCupom: q.descCupom, descPix: q.descPix, total: q.total },
        criadaEm: agora.toISOString()
      });
      location.href = `reserva.html?codigo=${encodeURIComponent(r.codigo)}`;
    } catch (e) {
      showErr(e.message || 'Não foi possível concluir. Tente de novo em instantes.');
      btn.disabled = false; btn.innerHTML = label;
    }
  });

  render();
  // se já veio com datas válidas, pode começar no passo 1 com tudo preenchido
})();

(async () => {
  const { $, $$, icon, esc, api, img, brl, fmtRange, fmtLong, fmtShort, plural, diffDays, addDays, parse, qs, toast } = EV;
  const root = $('#res');
  const codigo = qs.get('codigo');
  let r = codigo ? await api.reserva(codigo) : null;
  if (!r) {
    root.innerHTML = `<div class="empty"><h1 class="h2">Não encontramos essa reserva</h1><p>Confira o código no e-mail de confirmação. <a class="link" href="index.html">Voltar para o início</a></p></div>`;
    return;
  }
  const c = await api.chale((await api.chales()).find(x => x.id === r.chaleId).slug);
  let timer = null;

  /* QR Code ilustrativo (padrão gerado a partir do código, não é um Pix real) */
  function qr(seed) {
    const N = 29; let h = 2166136261;
    for (const ch of seed) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    const rnd = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 1000) / 1000; };
    const finder = (x, y) => [[0, 0], [N - 7, 0], [0, N - 7]].some(([a, b]) => x >= a && x < a + 7 && y >= b && y < b + 7);
    const fcell = (x, y) => { for (const [a, b] of [[0, 0], [N - 7, 0], [0, N - 7]]) { if (x >= a && x < a + 7 && y >= b && y < b + 7) { const i = x - a, j = y - b; return i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4); } } return false; };
    const sep = (x, y) => [[0, 0], [N - 8, 0], [0, N - 8]].some(([a, b]) => x >= a && x < a + 8 && y >= b && y < b + 8);
    let p = '';
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const on = finder(x, y) ? fcell(x, y) : sep(x, y) ? false : rnd() > .52;
      if (on) p += `M${x} ${y}h1v1h-1z`;
    }
    return `<svg viewBox="0 0 ${N} ${N}" role="img" aria-label="QR Code Pix de demonstração" shape-rendering="crispEdges"><path d="${p}" fill="#20241D"/></svg>`;
  }
  const pixCode = r => `00020126580014BR.GOV.BCB.PIX0136estancia-verdejante-demo520400005303986540${String(r.valores.total.toFixed(2)).length}${r.valores.total.toFixed(2)}5802BR5919ESTANCIA VERDEJANTE6013SAPUCAI-MIRIM62090505${r.codigo.replace('-', '')}6304DEMO`;

  function ics() {
    const d = s => s.replace(/-/g, '');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Estancia Verdejante//Reservas//PT', 'BEGIN:VEVENT',
      `UID:${r.codigo}@estanciaverdejante`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART;VALUE=DATE:${d(r.checkin)}`, `DTEND;VALUE=DATE:${d(r.checkout)}`,
      `SUMMARY:${c.nome} — reserva ${r.codigo}`, `LOCATION:${c.cidade}\\, ${c.estado}`,
      `DESCRIPTION:Check-in a partir das ${c.regras.checkin}. Check-out até ${c.regras.checkout}. Código ${r.codigo}.`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([body], { type: 'text/calendar' }));
    a.download = `reserva-${r.codigo}.ics`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function render() {
    clearInterval(timer);
    const inD = parse(r.checkin), outD = parse(r.checkout), n = diffDays(inD, outD);
    const first = r.hospede ? r.hospede.nome.split(' ')[0] : '';
    const expired = r.status === 'aguardando-pagamento' && new Date(r.pagamento.expiraEm) < new Date();
    const head = {
      'confirmada': { cls: '', ic: 'check', t: `Reserva confirmada${first ? `, ${esc(first)}` : ''}!`, p: `O ${esc(c.nome)} está guardado para vocês de ${fmtRange(inD, outD)}. Enviamos os detalhes para ${esc(r.hospede?.email || 'o seu e-mail')}.` },
      'aguardando-pagamento': expired
        ? { cls: 'cancel', ic: 'clock', t: 'O prazo do Pix terminou', p: 'As datas foram liberadas. Gere um novo código para tentar guardá-las de novo.' }
        : { cls: 'wait', ic: 'clock', t: 'Falta só o Pix', p: `Pague em até 30 minutos para garantir ${fmtRange(inD, outD)} no ${esc(c.nome)}.` },
      'cancelada': { cls: 'cancel', ic: 'x', t: 'Reserva cancelada', p: 'As datas foram liberadas no calendário. Se quiser, escolha novas datas.' }
    }[r.status];

    const v = r.valores;
    const pago = r.status === 'confirmada';
    root.innerHTML = `
      <div class="res-head">
        <span class="res-mark ${head.cls}">${icon(head.ic)}</span>
        <div>
          <h1>${head.t}</h1>
          <p>${head.p}</p>
          <span class="code">Código da reserva <b>${esc(r.codigo)}</b><button type="button" data-copy="${esc(r.codigo)}" aria-label="Copiar código">${icon('copy', 'sm')}</button></span>
        </div>
      </div>

      <div class="res-grid">
        <div>
          ${r.status === 'aguardando-pagamento' && !expired ? `
          <section class="panel" aria-labelledby="pix-t">
            <h2 class="h3" id="pix-t">Pague com Pix</h2>
            <div class="pix">
              <div class="qr">${qr(r.codigo)}</div>
              <div>
                <ol><li><span>Abra o app do seu banco e escolha pagar com Pix.</span></li><li><span>Escaneie o código ou use o Pix copia e cola.</span></li><li><span>Confira o valor de <b>${brl(v.total, 2)}</b> e confirme.</span></li></ol>
                <p class="timer">${icon('clock', 'sm')}<span id="countdown">30:00</span> para pagar</p>
              </div>
            </div>
            <div class="copyline"><label class="sr-only" for="pix-code">Pix copia e cola</label><input class="inp" id="pix-code" readonly value="${pixCode(r)}"><button class="btn btn-line" type="button" data-copy-pix>${icon('copy', 'sm')}Copiar</button></div>
            <div class="pix-actions"><button class="btn btn-primary" type="button" id="simulate">${icon('check', 'sm')}Simular pagamento aprovado</button></div>
            <p class="small muted" style="margin-top:12px">Código e QR de demonstração; nenhum pagamento é feito.</p>
          </section>` : ''}
          ${expired ? `<section class="panel"><h2 class="h3">Gerar um novo Pix</h2><p class="muted" style="margin-bottom:18px">Se as datas ainda estiverem livres, criamos um novo código com mais 30 minutos.</p><button class="btn btn-primary" type="button" id="renew">Gerar novo Pix</button></section>` : ''}

          <section class="panel" aria-labelledby="det-t">
            <h2 class="h3" id="det-t">Sua estadia</h2>
            <div class="kv">
              <div><span>Check-in</span><b>${fmtLong(inD)}</b><span>a partir das ${c.regras.checkin}</span></div>
              <div><span>Check-out</span><b>${fmtLong(outD)}</b><span>até ${c.regras.checkout}</span></div>
              <div><span>Hóspedes</span><b>${r.hospede ? esc(r.hospede.nome) : ''}${r.hospede?.acompanhante ? ` e ${esc(r.hospede.acompanhante)}` : r.hospedes > 1 ? ' e acompanhante' : ''}</b></div>
              <div><span>Chegada prevista</span><b>${esc(r.chegada || 'Não informada')}</b></div>
              ${r.ocasiao ? `<div><span>Ocasião</span><b>${esc(r.ocasiao)}</b></div>` : ''}
              <div><span>Experiências</span><b>${r.pacotes?.length ? r.pacotes.map(p => esc(p.nome)).join(', ') : 'Nenhuma'}</b></div>
              ${r.observacoes ? `<div style="grid-column:1/-1"><span>Pedido para a equipe</span><b style="font-weight:500">${esc(r.observacoes)}</b></div>` : ''}
            </div>
          </section>

          <section class="panel" aria-labelledby="pg-t">
            <h2 class="h3" id="pg-t">Pagamento</h2>
            <div class="lines" style="margin-top:0">
              ${v.grupos.map(g => `<div class="line"><span>${brl(g.valor)} × ${plural(g.qtd, 'noite', 'noites')}</span><span class="price">${brl(g.valor * g.qtd)}</span></div>`).join('')}
              <div class="line"><span>Taxa de limpeza</span><span class="price">${brl(v.limpeza)}</span></div>
              ${(r.pacotes || []).map(p => `<div class="line"><span>${esc(p.nome)}</span><span class="price">${brl(p.preco)}</span></div>`).join('')}
              ${v.descCupom ? `<div class="line disc"><span>Cupom ${esc(r.cupom)}</span><span class="price">−${brl(v.descCupom, 2)}</span></div>` : ''}
              ${v.descPix ? `<div class="line disc"><span>Desconto no Pix</span><span class="price">−${brl(v.descPix, 2)}</span></div>` : ''}
              <div class="line total"><span>${pago ? 'Total pago' : 'Total'}</span><span class="price">${brl(v.total, 2)}</span></div>
            </div>
            <p class="small muted" style="margin-top:14px">${r.pagamento.metodo === 'pix' ? (pago ? 'Pago com Pix.' : 'Pagamento com Pix.') : `${esc(r.pagamento.bandeira)} final ${esc(r.pagamento.final)}, ${r.pagamento.parcelas > 1 ? `${r.pagamento.parcelas}x de ${brl(v.total / r.pagamento.parcelas, 2)} sem juros` : 'à vista'}.`}</p>
          </section>
        </div>

        <aside>
          <div class="panel" style="padding:0;overflow:hidden">
            <div style="aspect-ratio:4/3">${img(c, c.mosaico[0], '360px', { alt: '', eager: true }).replace('<img ', '<img style="width:100%;height:100%;object-fit:cover" ')}</div>
            <div style="padding:22px">
              <b class="h3" style="display:block">${esc(c.nome)}</b>
              <p class="muted small" style="margin:4px 0 20px">${esc(c.cidade)}, ${esc(c.estado)}. ${plural(n, 'noite', 'noites')}, café da manhã incluso.</p>
              <ol class="timeline">
                <li class="ok"><span class="dot">${icon('check')}</span><div><b>Reserva feita</b><span>${new Date(r.criadaEm).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span></div></li>
                <li class="${pago ? 'ok' : r.status === 'cancelada' ? '' : 'now'}"><span class="dot">${icon(pago ? 'check' : 'clock')}</span><div><b>${pago ? 'Pagamento aprovado' : r.status === 'cancelada' ? 'Pagamento não concluído' : 'Aguardando o Pix'}</b><span>${pago ? 'Confirmação enviada por e-mail' : r.status === 'cancelada' ? 'Reserva cancelada' : 'Até 30 minutos'}</span></div></li>
                <li class="${pago ? 'now' : ''}"><span class="dot">${icon('key')}</span><div><b>Instruções de chegada</b><span>Enviadas 2 dias antes, com a senha do self check-in</span></div></li>
                <li><span class="dot">${icon('leaf')}</span><div><b>Check-in</b><span>${fmtShort(inD)}, a partir das ${c.regras.checkin}</span></div></li>
              </ol>
            </div>
          </div>
          <div class="panel res-actions">
            ${r.status !== 'cancelada' ? `<button class="btn btn-line btn-block" type="button" id="ics">${icon('download', 'sm')}Adicionar à agenda</button>` : ''}
            <a class="btn btn-line btn-block" href="https://www.google.com/maps/search/?api=1&query=${c.localizacao.lat},${c.localizacao.lng}" target="_blank" rel="noopener">${icon('pin', 'sm')}Como chegar</a>
            <a class="btn btn-line btn-block" href="${r.status === 'cancelada' ? `chale.html?c=${c.slug}` : 'index.html'}">${r.status === 'cancelada' ? 'Escolher novas datas' : 'Voltar ao início'}</a>
            ${r.status !== 'cancelada' ? `<p style="text-align:center;margin-top:8px"><button type="button" class="danger" id="cancel">Cancelar reserva</button></p>` : ''}
          </div>
        </aside>
      </div>`;

    // interações
    $$('[data-copy]', root).forEach(b => b.onclick = () => copy(b.dataset.copy, 'Código copiado'));
    const cp = $('[data-copy-pix]', root); if (cp) cp.onclick = () => copy($('#pix-code').value, 'Código Pix copiado');
    const sim = $('#simulate'); if (sim) sim.onclick = async () => {
      sim.disabled = true; sim.innerHTML = `<span class="spinner" aria-hidden="true"></span>Confirmando pagamento…`;
      await new Promise(x => setTimeout(x, 1200));
      r = await api.atualizarReserva(r.id, { codigo: r.codigo, status: 'confirmada', pagamento: { ...r.pagamento, pagoEm: new Date().toISOString() } });
      render(); scrollTo({ top: 0, behavior: 'smooth' }); toast('Pagamento aprovado');
    };
    const rn = $('#renew'); if (rn) rn.onclick = async () => {
      const others = (await api.reservas(c.id)).filter(x => x.id !== r.id);
      const set = EV.bookedSet(others);
      if (!EV.rangeFree(set, inD, outD)) { toast('Essas datas já foram reservadas. Escolha outras.'); return; }
      r = await api.atualizarReserva(r.id, { codigo: r.codigo, pagamento: { ...r.pagamento, expiraEm: new Date(Date.now() + 30 * 60000).toISOString() } });
      render();
    };
    const ic = $('#ics'); if (ic) ic.onclick = ics;
    const cn = $('#cancel'); if (cn) cn.onclick = async () => {
      if (cn.dataset.sure !== '1') {
        cn.dataset.sure = '1';
        const gratis = diffDays(new Date(), inD) >= c.cancelamento.diasGratis;
        cn.textContent = gratis ? 'Confirmar cancelamento (reembolso integral)' : `Confirmar cancelamento (reembolso de ${c.cancelamento.percentualDepois}% das diárias)`;
        setTimeout(() => { if (cn.isConnected) { cn.dataset.sure = ''; cn.textContent = 'Cancelar reserva'; } }, 6000);
        return;
      }
      r = await api.atualizarReserva(r.id, { codigo: r.codigo, status: 'cancelada', canceladaEm: new Date().toISOString() });
      render(); scrollTo({ top: 0, behavior: 'smooth' }); toast('Reserva cancelada');
    };

    // contagem regressiva do Pix
    const cd = $('#countdown');
    if (cd) {
      const end = new Date(r.pagamento.expiraEm).getTime();
      const tick = () => {
        const s = Math.max(0, Math.round((end - Date.now()) / 1000));
        cd.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        if (!s) { clearInterval(timer); render(); }
      };
      tick(); timer = setInterval(tick, 1000);
    }
  }
  async function copy(t, msg) {
    try { await navigator.clipboard.writeText(t); toast(msg); }
    catch { const i = $('#pix-code'); if (i) { i.select(); document.execCommand('copy'); } toast(msg); }
  }
  render();
})();

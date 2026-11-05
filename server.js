/*
 * Servidor do site Estância Verdejante.
 * Serve as páginas de /public e a API de dados simulados (json-server) no mesmo endereço.
 *
 * Variáveis de ambiente:
 *   PORT       porta (o Render define sozinho; localmente usa 3000)
 *   RESET_DB   "true" restaura db.json a partir de db.seed.json ao iniciar
 */
const fs = require('fs');
const path = require('path');
const jsonServer = require('json-server');

const ROOT = __dirname;
const DB = path.join(ROOT, 'db.json');
const SEED = path.join(ROOT, 'db.seed.json');

if (!fs.existsSync(DB) || process.env.RESET_DB === 'true') {
  fs.copyFileSync(SEED, DB);
  console.log('Dados de demonstração restaurados a partir de db.seed.json');
}

const server = jsonServer.create();
const router = jsonServer.router(DB);
const defaults = jsonServer.defaults({
  static: path.join(ROOT, 'public'),
  logger: process.env.NODE_ENV !== 'production',
  noCors: true
});

server.disable('x-powered-by');

// Verificação de saúde usada pelo Render
server.get('/healthz', (req, res) => res.json({ ok: true }));

// Fotos com cache longo no navegador (os nomes mudam quando a imagem muda)
const express = require('express');
server.use('/assets/img', express.static(path.join(ROOT, 'public', 'assets', 'img'), { maxAge: '30d' }));

server.use(defaults);

// Regras de escrita: a API pública só lê dados, cria reservas e atualiza status/pagamento de uma reserva.
server.use((req, res, next) => {
  const m = req.method;
  if (m === 'GET' || m === 'HEAD' || m === 'OPTIONS') return next();
  if (m === 'POST' && req.path === '/reservas') return next();
  if (m === 'PATCH' && /^\/reservas\/\d+$/.test(req.path)) return next();
  return res.status(405).json({ erro: 'Operação não permitida.' });
});

server.use(jsonServer.bodyParser);

const RESERVA_CAMPOS = ['codigo', 'chaleId', 'checkin', 'checkout', 'hospedes', 'status', 'origem', 'hospede', 'chegada', 'ocasiao',
  'observacoes', 'pacotes', 'cupom', 'pagamento', 'valores', 'criadaEm'];
const STATUS = ['aguardando-pagamento', 'confirmada', 'cancelada'];
const DATA = /^\d{4}-\d{2}-\d{2}$/;

server.use((req, res, next) => {
  const b = req.body || {};
  if (req.method === 'POST' && req.path === '/reservas') {
    // aceita só os campos conhecidos e confere o básico
    Object.keys(b).forEach(k => { if (!RESERVA_CAMPOS.includes(k)) delete b[k]; });
    delete b.id;
    if (!DATA.test(b.checkin || '') || !DATA.test(b.checkout || '') || b.checkout <= b.checkin) return res.status(400).json({ erro: 'Datas inválidas.' });
    if (!STATUS.includes(b.status)) return res.status(400).json({ erro: 'Status inválido.' });
    if (!b.codigo || typeof b.codigo !== 'string') return res.status(400).json({ erro: 'Código da reserva ausente.' });
    // evita reservas sobrepostas no mesmo chalé
    const ativas = router.db.get('reservas').filter(r => r.chaleId === b.chaleId && r.status !== 'cancelada' &&
      !(r.status === 'aguardando-pagamento' && r.pagamento && new Date(r.pagamento.expiraEm) < new Date())).value();
    const conflito = ativas.some(r => b.checkin < r.checkout && r.checkin < b.checkout);
    if (conflito) return res.status(409).json({ erro: 'Essas datas acabaram de ser reservadas.' });
  }
  if (req.method === 'PATCH') {
    // só altera quem sabe o código da reserva
    const id = Number(req.path.split('/').pop());
    const atual = router.db.get('reservas').find({ id }).value();
    if (!atual) return res.status(404).json({ erro: 'Reserva não encontrada.' });
    if (b.codigo !== atual.codigo) return res.status(403).json({ erro: 'Código da reserva não confere.' });
    Object.keys(b).forEach(k => { if (!['status', 'pagamento', 'canceladaEm'].includes(k)) delete b[k]; });
    if (b.status && !STATUS.includes(b.status)) return res.status(400).json({ erro: 'Status inválido.' });
  }
  next();
});

// Listagens de reservas não expõem dados pessoais; a consulta pelo código da reserva mostra tudo.
router.render = (req, res) => {
  let data = res.locals.data;
  if (req.method === 'GET' && req.path.startsWith('/reservas') && !req.query.codigo) {
    const limpa = r => ({ id: r.id, chaleId: r.chaleId, checkin: r.checkin, checkout: r.checkout, status: r.status,
      pagamento: r.pagamento && r.pagamento.expiraEm ? { expiraEm: r.pagamento.expiraEm } : undefined });
    data = Array.isArray(data) ? data.map(limpa) : data && data.id ? limpa(data) : data;
  }
  res.jsonp(data);
};

server.use(router);

const PORT = Number(process.env.PORT) || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Estância Verdejante no ar: http://localhost:${PORT}`);
});

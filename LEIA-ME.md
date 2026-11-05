# Chalés Estância Verdejante — site de reservas (demonstração)

## Como rodar

### Com a API de dados simulados (recomendado para a apresentação)
Precisa do Node.js 18 ou mais novo.

```bash
npm install
npm start
```

Abra **http://localhost:3000**. As reservas feitas no checkout são gravadas em `db.json`
e passam a bloquear as datas no calendário na hora.

Para voltar os dados ao estado original antes de uma nova apresentação (com o servidor parado):

```bash
npm run reset
```

### Sem servidor
Dá para abrir `public/index.html` direto no navegador. Os dados vêm de `public/data/db.js`
e as reservas novas ficam salvas só naquele navegador (localStorage).

## Publicar no Render

O projeto já vem pronto para o Render (`render.yaml`, `server.js`, `.node-version`).

1. Crie um repositório no GitHub e envie esta pasta (sem `node_modules`, que já está no `.gitignore`):
   ```bash
   git init
   git add .
   git commit -m "Site Estância Verdejante"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/estancia-verdejante.git
   git push -u origin main
   ```
2. No Render: **New > Blueprint**, conecte o GitHub e escolha o repositório. Ele lê o `render.yaml` e cria o serviço sozinho.
   - Se preferir sem Blueprint: **New > Web Service**, Build Command `npm ci`, Start Command `npm start`, Health Check Path `/healthz`.
3. Em alguns minutos o site fica em `https://estancia-verdejante.onrender.com` (ou o nome que o Render der). A cada `git push` ele publica de novo.

**Bom saber sobre o Render (plano gratuito):**
- O serviço "dorme" depois de 15 minutos sem visitas; a primeira visita depois disso demora cerca de 1 minuto. Abra o site um pouco antes de apresentar.
- O disco não é permanente: reservas feitas no site somem quando o serviço reinicia. Com `RESET_DB=true` (já configurado), cada reinício volta para os dados de demonstração limpos. Para guardar reservas de verdade, o próximo passo é trocar o `db.json` por um banco de dados.
- Domínio próprio (ex.: `www.estanciaverdejante.com.br`): Render > Settings > Custom Domains.

### Regras da API publicada
O `server.js` protege a API: qualquer pessoa pode **ler** chalés, pacotes, cupons e a disponibilidade, e **criar reservas** — mas não pode apagar ou editar chalés e preços. Reservas em datas já ocupadas são recusadas. A listagem de reservas não mostra dados dos hóspedes; só a consulta pelo código da reserva mostra os detalhes, e só quem tem o código consegue pagar ou cancelar.

## Páginas
| Página | O que faz |
| --- | --- |
| `index.html` | Home: busca por datas, lista de chalés com disponibilidade, experiências, avaliações, localização |
| `chale.html?c=nevoa-da-montanha` | Fotos, galeria por ambiente, calendário de disponibilidade com preço por noite, card de reserva |
| `checkout.html?c=…&in=AAAA-MM-DD&out=AAAA-MM-DD&h=2` | Checkout em 3 passos: estadia + experiências, dados do hóspede, pagamento (Pix ou cartão) |
| `reserva.html?codigo=EV-XXXXX` | Confirmação: Pix com QR e contagem regressiva, simular pagamento, agenda (.ics), cancelar |

## Roteiro rápido para demonstrar
1. Na home, escolha datas e veja o chalé aparecer como livre ou ocupado.
2. Abra o chalé, escolha as datas no calendário (sextas e sábados custam mais; Natal, Réveillon e Carnaval aparecem em destaque).
3. No checkout, marque uma ocasião e uma experiência, aplique o cupom **BEMVINDO10**.
4. Pagamento com cartão **4000 0000 0000 0002** mostra a recusa; **4242 4242 4242 4242** aprova.
5. Pagamento com Pix leva à tela do QR; clique em "Simular pagamento aprovado".
6. Volte ao chalé: as datas reservadas aparecem riscadas.

CPF de teste válido: 529.982.247-25.

## API (json-server)
| Rota | Uso |
| --- | --- |
| `GET /chales?slug=` | Dados do chalé, fotos, tarifas, regras |
| `GET /pacotes` | Experiências adicionais |
| `GET /cupons?codigo=` | Cupons |
| `GET /reservas?chaleId=` | Reservas (bloqueiam o calendário) |
| `POST /reservas` · `PATCH /reservas/:id` | Criar, pagar ou cancelar |

## Chalés cadastrados
| Chalé | Página |
| --- | --- |
| Névoa da Montanha | `chale.html?c=nevoa-da-montanha` |
| Recanto da Mata | `chale.html?c=recanto-da-mata` |

Para cadastrar outro chalé:
1. Coloque as fotos em `public/assets/img/<slug-do-chale>/` (versões `-640.jpg` e `-1200.jpg`).
2. Adicione o chalé em `chales` no `db.seed.json` (mesmo formato dos outros), com `id` novo, e copie o arquivo para `db.json`.
3. Atualize `public/data/db.js` para o modo sem servidor.
4. As fotos das experiências ficam em `public/assets/img/pacotes/` e servem para todos os chalés; cada chalé escolhe as suas em `pacotesIds`.

## Valores
Diárias, taxa de limpeza, preços das experiências, cupons e reservas existentes são **fictícios**,
só para a demonstração. Notas, comodidades, regras e fotos vêm do anúncio real do chalé.
Edite tudo em `db.json`.

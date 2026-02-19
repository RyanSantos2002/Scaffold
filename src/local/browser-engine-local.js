/**
 * browser-engine-local.js
 *
 * Script Playwright para capturar dados do FrontM8 LOCAL (React SPA + MUI DataGrid).
 *
 * Diferenças em relação à versão Cloud:
 *  - Sem iframe (React SPA)
 *  - Grid é MUI X DataGrid Pro: linhas são <div data-id="..."> (não <table tbody tr>)
 *  - Editar → double-click na linha ou pegar data-id e navegar para /:rota/:id
 *  - Resposta a interceptar: requisição POST /sync (chamada find do formulário)
 *
 * Fluxo (espelhado do browser-engine.js original):
 *  1. Carregar sessão salva (sem novo login)
 *  2. Navegar para a tela via URL direta
 *  3. Aguardar grid carregar (div[data-id])
 *  4. Pegar data-id da primeira linha
 *  5. Navegar diretamente para /:rota/:id (equivalente ao clique Editar)
 *  6. Interceptar response do /sync (= find do formulário)
 *  7. Salvar JSON em output/json/<nomeTela>_sync.json
 *
 * Como usar:
 *   npm run local:capturar
 */

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

// ─── CONFIGURAÇÃO ────────────────────────────────────────────────────────────
const configPath = path.resolve(__dirname, '@Config', 'index.js');
if (!fs.existsSync(configPath)) {
  console.error('❌ Arquivo de configuração não encontrado: ' + configPath);
  process.exit(1);
}
const config = require(configPath);

const BASE_URL    = config.baseUrl;   // ex: 'http://localhost:5173'
const TENANT      = config.tenant;    // ex: 'Treinamento'
const ROTA_TELA   = config.rotaTela;  // ex: 'financeiro/transferencia'
const NOME_TELA   = config.nomeTela;  // ex: 'LancamentoTransferencia'

const SESSION_FILE = path.resolve(__dirname, '..', '..', 'session-local.json');
const OUTPUT_DIR   = path.resolve(__dirname, '..', '..', 'output', 'json');
// ─────────────────────────────────────────────────────────────────────────────

if (!fs.existsSync(SESSION_FILE)) {
  console.error('❌ session-local.json não encontrado! Rode primeiro: npm run local:login');
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

(async () => {
  console.log('🚀 Iniciando browser com sessão salva...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    storageState: SESSION_FILE,
  });

  const page = await context.newPage();

  // ──────────────────────────────────────────────────────────────────────────
  // 1️⃣ Navegar diretamente para a tela de LISTAGEM
  // ──────────────────────────────────────────────────────────────────────────
  const telaUrl = `${BASE_URL}/${TENANT}/${ROTA_TELA}`;
  console.log(`🌐 Abrindo tela: ${telaUrl}`);
  await page.goto(telaUrl, { waitUntil: 'networkidle' });

  // Sessão expirada?
  if (page.url().includes('login')) {
    console.error('❌ Sessão expirada! Rode: npm run local:login');
    await browser.close();
    process.exit(1);
  }
  console.log(`✅ Tela carregada: ${page.url()}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 2️⃣ FORÇAR LOAD DA GRID — clicar na lupa de pesquisa
  //    (equivalente ao click do cabeçalho de coluna no original)
  //    react-query tem enabled:false por padrão, só carrega após pesquisa
  // ──────────────────────────────────────────────────────────────────────────
  console.log('🔍 Clicando em Pesquisar para carregar a grid...');

  try {
    // Botão de pesquisa da toolbar (classe: toolbar-search, title: Pesquisar)
    const btnPesquisar = page.locator('button.toolbar-search, button[title="Pesquisar"]').first();
    await btnPesquisar.waitFor({ state: 'visible', timeout: 15000 });
    
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/sync') && r.status() === 200,
        { timeout: 30000 }
      ),
      btnPesquisar.click(),
    ]);
    console.log('✅ Pesquisa executada e /sync recebido para a grid!');
  } catch {
    console.log('⚠️ Botão Pesquisar não encontrado ou timeout. Tentando pressionar Enter...');
    try {
      await page.keyboard.press('Enter');
      await page.waitForResponse(
        (r) => r.url().includes('/sync') && r.status() === 200,
        { timeout: 15000 }
      );
    } catch {
      console.log('⚠️ Continuando sem confirmar load da grid...');
    }
  }

  await page.waitForTimeout(1000);

  // ──────────────────────────────────────────────────────────────────────────
  // 3️⃣ Aguardar grid carregar — MUI DataGrid Pro usa <div data-id="..."> por linha
  //    (equivalente ao frame.locator('table tbody tr').first() do original)
  // ──────────────────────────────────────────────────────────────────────────
  console.log('⏳ Aguardando linhas da grid (div[data-id])...');

  let primeiroDataId = null;

  try {
    await page.waitForSelector('.MuiDataGrid-row[data-id]', {
      state: 'visible',
      timeout: 20000,
    });
    primeiroDataId = await page.locator('.MuiDataGrid-row[data-id]').first().getAttribute('data-id');
    console.log(`✅ Grid carregada! 🆔 ID da primeira linha: ${primeiroDataId}`);

  } catch {
    // Fallback: qualquer elemento com data-id
    console.log('   ↪ Tentando seletor fallback [data-id]...');
    try {
      await page.waitForSelector('[data-id]', { state: 'visible', timeout: 10000 });
      primeiroDataId = await page.locator('[data-id]').first().getAttribute('data-id');
      console.log(`✅ Grid carregada (fallback)! 🆔 ID: ${primeiroDataId}`);
    } catch {
      console.error('❌ Grid não carregou ou sem registros. Verifique a URL, sessão e se há dados na tela.');
      await browser.close();
      process.exit(1);
    }
  }


  if (!primeiroDataId) {
    console.error('❌ Não foi possível obter o data-id da primeira linha.');
    await browser.close();
    process.exit(1);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 3️⃣ Navegar diretamente para o formulário /:rota/:id
  //    (equivalente ao btnEditar.click() do original — mais robusto para SPA)
  //    e interceptar a requisição /sync (chamada ao service.find)
  // ──────────────────────────────────────────────────────────────────────────
  const formUrl = `${BASE_URL}/${TENANT}/${ROTA_TELA}/${primeiroDataId}`;
  console.log(`📄 Abrindo formulário: ${formUrl}`);
  console.log(`📡 Interceptando requisição /sync...`);

  const [responseSync] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/sync') && r.status() === 200,
      { timeout: 30000 }
    ),
    page.goto(formUrl, { waitUntil: 'domcontentloaded' }),
  ]);

  const syncUrl  = responseSync.url();
  const syncBody = await responseSync.text();

  console.log(`✅ Requisição sync interceptada: ${syncUrl}`);

  // ──────────────────────────────────────────────────────────────────────────
  // 4️⃣ Salvar o JSON da resposta
  // ──────────────────────────────────────────────────────────────────────────
  let parsed;
  try {
    parsed = JSON.parse(syncBody);
  } catch {
    parsed = { raw: syncBody };
  }

  const saida = {
    url: syncUrl,
    recordId: primeiroDataId,
    capturedAt: new Date().toISOString(),
    response: parsed,
  };

  const filePath = path.join(OUTPUT_DIR, `${NOME_TELA}_sync.json`);
  fs.writeFileSync(filePath, JSON.stringify(saida, null, 2), 'utf-8');

  console.log(`\n✅ Response sync salvo em: ${filePath}`);
  console.log('🚀 Processo finalizado!');

  await browser.close();
})();

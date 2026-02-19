/**
 * login-handler-local.js
 *
 * Script Playwright para autenticação AUTOMÁTICA no FrontM8 LOCAL.
 * Preenche usuário e senha, aguarda seleção de empresa pelo usuário
 * (ou seleciona automaticamente se empresaNome estiver configurado),
 * e salva a sessão em session-local.json.
 *
 * Como usar:
 *   npm run local:login
 *   (ou: node src/local/login-handler-local.js)
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

const BASE_URL    = config.baseUrl;
const TENANT      = config.tenant;
const USERNAME    = config.username;
const PASSWORD    = config.password;
const EMPRESA     = config.empresaNome || '';
const SESSION_FILE = path.resolve(__dirname, '..', '..', 'session-local.json');
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  console.log('🚀 Iniciando login automático no FrontM8 Local...');
  console.log(`   URL: ${BASE_URL}/${TENANT}/login`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
  });

  const context = await browser.newContext();
  const page    = await context.newPage();

  // 1️⃣ Abrindo tela de login
  await page.goto(`${BASE_URL}/${TENANT}/login`, { waitUntil: 'networkidle' });
  console.log('✅ Tela de login aberta.');

  // 2️⃣ Preenchendo usuário
  console.log(`👤 Preenchendo usuário: ${USERNAME}`);
  await page.locator('#usuario').waitFor({ state: 'visible', timeout: 30000 });
  await page.locator('#usuario').fill(USERNAME);

  // 3️⃣ Preenchendo senha
  console.log('🔑 Preenchendo senha...');
  await page.locator('#senha').fill(PASSWORD);

  // 4️⃣ Clicando em Entrar
  console.log('�️ Clicando em Entrar...');
  await page.locator('button[type="submit"]').click();

  // 5️⃣ Aguardar tela de seleção de empresa
  console.log('⏳ Aguardando tela de seleção de empresa...');
  await page.waitForURL(`**/${TENANT}/selecao-empresa`, { timeout: 60000 });
  console.log('✅ Login OK! Tela de seleção de empresa aberta.');

  // 6️⃣ Selecionar empresa
  if (EMPRESA) {
    console.log(`🏢 Selecionando empresa: "${EMPRESA}"...`);
    // Aguarda texto do estabelecimento aparecer e clica nele
    await page.getByText(EMPRESA, { exact: false }).first().click();
  } else {
    console.log('🏢 Nenhuma empresa configurada. Aguardando lista de estabelecimentos carregar...');

    // Aguarda o h1 "Selecione a Empresa" aparecer (confirma que a tela carregou)
    await page.getByRole('heading', { name: 'Selecione a Empresa' }).waitFor({ state: 'visible', timeout: 30000 });
    console.log('✅ Tela de seleção carregada!');

    // Aguarda aparecer pelo menos um item clicável (qualquer elemento <span> dentro de um container com establishment id)
    await page.waitForTimeout(2000); // tempo para a listagem carregar via API

    // Clica no primeiro estabelecimento usando evaluate para contornar styled-components
    const clicou = await page.evaluate(() => {
      // Busca spans que são filhos de containers com estrutura de estabelecimento
      // O id do estabelecimento fica num <span> dentro de um círculo
      // O click real precisa ser no container pai clicável
      const spans = Array.from(document.querySelectorAll('span'));
      // Encontra o primeiro span que contenha só um número (ID do estabelecimento)
      for (const span of spans) {
        if (/^\d+$/.test(span.textContent?.trim() || '')) {
          // Sobe 3 níveis para chegar no container clicável do estabelecimento
          const container = span.closest('[class]')?.parentElement?.parentElement;
          if (container) {
            container.click();
            return true;
          }
        }
      }
      return false;
    });

    if (!clicou) {
      console.log('⚠️ Não encontrou estabelecimento via evaluate. Tentando clicar no primeiro item visível...');
      // Fallback: clica no primeiro elemento que contenha texto com número
      await page.locator('h1:has-text("Selecione a Empresa") ~ * span').first().click();
    } else {
      console.log('✅ Primeiro estabelecimento clicado!');
    }
  }


  // 7️⃣ Aguardar Home carregar
  console.log('⏳ Aguardando Home carregar...');
  await page.waitForURL(
    (url) => !url.toString().includes('selecao-empresa') && !url.toString().includes('login'),
    { timeout: 60000 }
  );
  console.log('🏠 Home carregada!');

  // 8️⃣ Aguardar consolidação dos tokens no localStorage
  console.log('⏳ Aguardando consolidação dos tokens (3s)...');
  await page.waitForTimeout(3000);

  // 9️⃣ Salvar sessão
  await context.storageState({ path: SESSION_FILE });
  console.log(`\n✅ Sessão salva em: ${SESSION_FILE}`);
  console.log('🎉 Login finalizado! Agora rode: npm run local:capturar\n');

  await browser.close();
})();

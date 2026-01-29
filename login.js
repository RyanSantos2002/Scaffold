const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('🌐 Abrindo tela de login...');
  await page.goto('https://app.erpm8.cloud/treinamento/Home/Index');

  console.log('👉 Faça o login manualmente');

  // 1️⃣ espera ir para seleção de empresa
  await page.waitForURL('**/Home/SelecaoEmpresa', { timeout: 120000 });
  console.log('✅ Login OK, tela de seleção aberta');

  // 2️⃣ seleciona estabelecimento
  console.log('🏢 Selecionando estabelecimento...');
  await page.click('text=2: ESTABELECIMENTO TESTE - 2');

  // 3️⃣ espera HOME REAL
  await page.waitForURL('**/Home/WorkspaceInicial**', { timeout: 120000 });
  console.log('🏠 Home carregada');

  // 4️⃣ tempo CRÍTICO para ASP.NET consolidar sessão
  await page.waitForTimeout(5000);

  // 5️⃣ salva sessão FINAL
  await context.storageState({ path: 'session.json' });

  console.log('✅ Sessão salva com sucesso!');

  await browser.close();
})();

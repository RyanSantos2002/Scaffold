const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Import configuration dynamically
const configPath = path.resolve(__dirname, '..', '..', 'capture', '@Config', 'index.js');
if (!fs.existsSync(configPath)) {
  console.error("Configuration file not found at " + configPath);
  process.exit(1);
}
const config = require(configPath);

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    storageState: 'session.json'
  });

  const page = await context.newPage();

  // 📁 Pastas de saída (Dentro de html-capture para evitar confusão)
  const outputBase = path.resolve(__dirname, 'output');
  const listaDir = path.join(outputBase, 'Lista');
  const formDir = path.join(outputBase, 'Form');

  [listaDir, formDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // Limpar pasta Form para evitar confusão com capturas anteriores
  if (fs.existsSync(formDir)) {
    fs.readdirSync(formDir).forEach(file => {
      fs.unlinkSync(path.join(formDir, file));
    });
  }

  // 🏠 Workspace
  console.log('🏠 Abrindo Workspace...');
  await page.goto(
    'https://app.erpm8.cloud/treinamento/Home/WorkspaceInicial?Id=2',
    { waitUntil: 'networkidle' }
  );

  // 📦 Abrir Módulo
  console.log(`📦 Abrindo Módulo ${config.modulo}...`);
  const moduloLink = page.locator(`a.--nf-modules-item-link[data-module-name="${config.modulo}"]`);
  await moduloLink.waitFor({ state: 'visible' });

  const [moduloPage] = await Promise.all([
    context.waitForEvent('page').catch(() => page),
    moduloLink.click({ force: true })
  ]);

  // 👉 Navegar até a Tela
  console.log(`👉 Navegando até ${config.menuPai} > ${config.idBotaoTela}...`);
  await moduloPage.getByText(config.menuPai.toUpperCase(), { exact: true }).click();
  await moduloPage.waitForTimeout(500);
  
  // Tentar clicar no botão pelo ID configurado
  const btnTela = moduloPage.locator(`button#${config.idBotaoTela}`);
  await btnTela.click();

  console.log('--- Identificando Frame de Conteúdo ---');
  const frame = moduloPage.frameLocator(".active iframe");

  console.log(`🖱️ Abrindo ${config.textoLinkListagem}...`);
  const [responseLista] = await Promise.all([
    moduloPage.waitForResponse(r =>
      r.url().toLowerCase().includes(config.keywordUrl.toLowerCase()) && r.status() === 200
    ),
    moduloPage.locator('a', { hasText: config.textoLinkListagem }).first().click()
  ]);

  const listaHtml = await responseLista.text();
  fs.writeFileSync(path.join(listaDir, `${config.tela}_listagem.html`), listaHtml);
  console.log('✅ HTML da listagem salvo.');

  // 🔁 FORÇAR LOAD DA GRID (Via Frame) - ORDENAÇÃO PRIMEIRO
  console.log(`🔁 Ordenando por "${config.colunaOrdenacao}" para fixar a primeira linha...`);
  
  const headerColuna = frame.locator('a.k-link.m8-cabecalho-coluna', { hasText: config.colunaOrdenacao });

  await headerColuna.waitFor({ state: 'visible', timeout: 30000 });
  await headerColuna.scrollIntoViewIfNeeded();

  console.log('🖱️ Clicando no cabeçalho para ordenar...');
  try {
    await Promise.all([
      moduloPage.waitForResponse(r =>
        r.url().toLowerCase().includes(config.keywordUrl.toLowerCase()) && r.status() === 200,
        { timeout: 30000 }
      ),
      headerColuna.click() 
    ]);
  } catch (err) {
    console.log('⚠️ Aviso: Falha no clique normal ou timeout. Tentando clique forçado no cabeçalho...');
    await headerColuna.click({ force: true });
    await moduloPage.waitForTimeout(2000); // Espera manual caso o waitForResponse falhe
  }

  // ⏳ Esperar grid recarregar após ordenação
  console.log('⏳ Aguardando recarregamento da grid após ordenação...');
  const firstRow = frame.locator('table tbody tr').first();
  await firstRow.waitFor({ state: 'visible', timeout: 30000 });
  
  // ✏️ Agora sim, identificar o ID da primeira linha ORDENADA
  console.log('✏️ Localizando botão Editar da primeira linha ordenada...');
  const btnEditar = firstRow.locator('button[title="Editar"]').first();
  await btnEditar.waitFor({ state: 'visible', timeout: 10000 });

  const dataUrl = await btnEditar.getAttribute('data-url');
  if (!dataUrl) throw new Error('❌ data-url não encontrado no botão Editar');

  console.log(`🔗 URL de edição encontrada: ${dataUrl}`);
  const recordId = dataUrl.split('?')[0].split('/').filter(Boolean).pop();
  console.log(`🆔 ID real da primeira linha: ${recordId}`);

  // 📄 Capturar formulário
  console.log(`📡 Aguardando carregamento do formulário ID ${recordId}...`);
  
  const keywordBase = config.keywordUrl.replace(/s$/, ''); 

  const [responseForm] = await Promise.all([
    moduloPage.waitForResponse(r => {
      const url = r.url();
      const status = r.status();
      const isCandidate = status === 200 && 
        !url.includes('.js') && 
        !url.includes('.css') && 
        !url.includes('Grid') &&
        (url.includes(`/${recordId}`) || url.toLowerCase().includes(keywordBase.toLowerCase()));
      
      return isCandidate;
    }, { timeout: 60000 }),
    btnEditar.click()
  ]);

  const finalUrl = responseForm.url();
  const actualId = finalUrl.split('?')[0].split('/').filter(Boolean).pop();
  console.log(`✅ Formulário capturado! ID: ${actualId}`);

  const formHtml = await responseForm.text();
  fs.writeFileSync(
    path.join(formDir, `cadastro_id_${actualId}.html`),
    formHtml
  );

  console.log(`✅ Formulário ${actualId} salvo com sucesso.`);
  console.log('🚀 Processo finalizado!');
  
  await browser.close();
})();
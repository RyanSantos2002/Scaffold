const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    storageState: 'session.json'
  });

  const page = await context.newPage();

  // 📁 Pastas de saída
  const outputBase = path.resolve(__dirname, '../output');
  const listaDir = path.join(outputBase, 'Lista');
  const formDir = path.join(outputBase, 'Form');

  [listaDir, formDir].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });

  // 🏠 Workspace
  console.log('🏠 Abrindo Workspace...');
  await page.goto(
    'https://app.erpm8.cloud/treinamento/Home/WorkspaceInicial?Id=2',
    { waitUntil: 'networkidle' }
  );

  // 📦 Abrir CRM
  const crmLink = page.locator('a.--nf-modules-item-link[data-module-name="CRM"]');
  await crmLink.waitFor({ state: 'visible' });

  const [crmPage] = await Promise.all([
    context.waitForEvent('page').catch(() => page),
    crmLink.click({ force: true })
  ]);

  // 👉 Navegar até Lista de Contas
  await crmPage.getByText('MOVIMENTO', { exact: true }).click();
  await crmPage.waitForTimeout(500);
  await crmPage.locator('button#Contas').click();

  console.log('--- Identificando Frame de Conteúdo ---');
  const frame = crmPage.frameLocator(".active iframe");

  console.log('🖱️ Abrindo Lista Cadastro de Contas...');
  const [responseLista] = await Promise.all([
    crmPage.waitForResponse(r =>
      r.url().toLowerCase().includes('contas') && r.status() === 200
    ),
    crmPage.locator('a', { hasText: 'Lista Cadastro de Contas' }).first().click()
  ]);

  const listaHtml = await responseLista.text();
  fs.writeFileSync(path.join(listaDir, 'contas_listagem.html'), listaHtml);
  console.log('✅ HTML da listagem salvo.');

  // 🔁 FORÇAR LOAD DA GRID (Via Frame)
  console.log('🔁 Preparando clique no cabeçalho "Código"...');
  
  const headerCodigo = frame.locator('a.k-link.m8-cabecalho-coluna', { hasText: 'Código' });

  // Espera estar visível e garante que não há nada na frente (como um loading)
  await headerCodigo.waitFor({ state: 'visible', timeout: 30000 });
  await headerCodigo.scrollIntoViewIfNeeded();

  console.log('🖱️ Clicando no cabeçalho...');
  try {
    await Promise.all([
      crmPage.waitForResponse(r =>
        r.url().toLowerCase().includes('contas') && r.status() === 200,
        { timeout: 30000 }
      ),
      // Tentamos o clique normal. Se falhar, o Playwright avisará o motivo.
      headerCodigo.click() 
    ]);
  } catch (err) {
    console.log('⚠️ Aviso: Falha no clique normal ou timeout da rede. Tentando clique forçado...');
    await headerCodigo.click({ force: true });
  }

  // ⏳ Esperar grid carregar linhas
  console.log('⏳ Aguardando linhas da grid...');
  const gridRows = frame.locator('table tbody tr').first();
  await gridRows.waitFor({ state: 'visible', timeout: 30000 });

  // ✏️ Editar primeira linha (Dentro do Frame)
  console.log('✏️ Localizando botão Editar...');
  const btnEditar = frame.locator('button[title="Editar"]').first();

  await btnEditar.waitFor({ state: 'visible', timeout: 10000 });

  const dataUrl = await btnEditar.getAttribute('data-url');
  if (!dataUrl) throw new Error('❌ data-url não encontrado no botão Editar');

  const recordId = dataUrl.split('/').pop();
  console.log(`🆔 ID encontrado: ${recordId}`);

  // 📄 Capturar formulário
  console.log('📡 Capturando formulário...');
  const [responseForm] = await Promise.all([
    crmPage.waitForResponse(r =>
      r.url().includes(`/${recordId}`) && r.status() === 200
    ),
    btnEditar.click()
  ]);

  const formHtml = await responseForm.text();
  fs.writeFileSync(
    path.join(formDir, `cadastro_id_${recordId}.html`),
    formHtml
  );

  console.log(`✅ Formulário ${recordId} salvo com sucesso.`);
  console.log('🚀 Processo finalizado!');
  
  await browser.close();
})();
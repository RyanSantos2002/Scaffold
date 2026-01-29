const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: 'session.json' });
  const page = await context.newPage();

  try {
    console.log('🌐 Navegando para URL alvo...');
    await page.goto('https://app.erpm8.cloud/treinamento/Home/WorkspaceInicial?Id=2', { waitUntil: 'networkidle' });
    
    console.log('📄 Título da página:', await page.title());
    
    await page.screenshot({ path: 'debug_screenshot.png' });
    console.log('📸 Screenshot salvo em debug_screenshot.png');
    
    const content = await page.content();
    fs.writeFileSync('debug_content.html', content);
    console.log('💾 HTML salvo em debug_content.html');

    const modules = await page.locator('a.--nf-modules-item-link').count();
    console.log(`🔢 Encontrados ${modules} links de módulos.`);
    
    if (modules > 0) {
        const firstModule = page.locator('a.--nf-modules-item-link').first();
        console.log('🔗 Primeiro módulo HTML:', await firstModule.evaluate(el => el.outerHTML));
    }

  } catch (err) {
    console.error('❌ Erro:', err);
  } finally {
    await browser.close();
  }
})();

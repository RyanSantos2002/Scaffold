const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Extrai metadata essencial do HTML de forma rápida e eficiente
 * Foca apenas no que é necessário para gerar código FrontM8
 */
function extractMetadata(config) {
  console.log(`\n📊 Extraindo metadata de: ${config.tela}...`);
  
  const baseDir = path.join(__dirname, '..', 'output', 'html', config.modulo, config.menuPai);
  const formDir = path.join(baseDir, 'form');
  
  // Encontrar arquivo HTML do formulário
  let formFile = null;
  if (fs.existsSync(formDir)) {
    const files = fs.readdirSync(formDir);
    const found = files.find(f => f.startsWith(`${config.tela}_form_`) && f.endsWith('.html'));
    if (found) formFile = path.join(formDir, found);
  }

  if (!formFile || !fs.existsSync(formFile)) {
    console.log('   ⚠️  Arquivo de formulário não encontrado');
    return null;
  }

  const html = fs.readFileSync(formFile, 'utf8');
  const $ = cheerio.load(html);

  const metadata = {
    module: config.modulo,
    menu: config.menuPai,
    screen: config.tela,
    modelName: '',
    tabs: [],
    fields: []
  };

  // 1. Extrair Model Name
  const formEl = $('form[model-name]').first();
  if (formEl.length) {
    metadata.modelName = formEl.attr('model-name').split('.').pop();
  }

  // 2. Extrair Abas (apenas as visíveis/válidas)
  const tabList = $('ul#frmContaTab, ul.nav-tabs, ul.tabbable').first();
  
  if (tabList.length) {
    tabList.find('li').each((i, el) => {
      const link = $(el).find('a').first();
      const name = link.text().trim().split(':')[0].trim();
      const href = link.attr('href');
      const tabId = href ? href.replace('#', '') : null;
      const onClick = $(el).attr('onclick');
      
      // Check for Grid presence in onclick attribute
      const hasGrid = onClick && (onClick.includes('AcaoGrid') || onClick.includes('tbl'));

      if (tabId && name) {
        metadata.tabs.push({
          name,
          id: tabId,
          hasGrid: !!hasGrid,
          // Placeholder for modelName, will try to find in tab content
          modelName: ''
        });
      }
    });
  }

  // 3. Extrair Campos (apenas do formulário principal)
  const mainForm = $('form').first();
  mainForm.find('.form-group').each((i, el) => {
    const label = $(el).find('label').first().text().trim();
    const input = $(el).find('input, select, textarea').first();
    
    if (input.length) {
      const name = input.attr('name');
      const id = input.attr('id');
      const type = input.attr('type') || input.prop('tagName').toLowerCase();
      
      // Pular campos ocultos e técnicos
      if (type === 'hidden' || !name || name === 'undefined') return;
      
      const required = input.attr('data-obrigatorio') === 'true' || 
                      input.attr('required') === 'required';
      const maxLength = input.attr('maxlength');
      
      // Detectar componente
      let component = 'InputText';
      if (input.is('select')) {
        component = input.attr('data-url_dados') ? 'Select2' : 'Select';
      } else if (input.is('textarea')) {
        component = 'TextArea';
      } else if (input.hasClass('mascara-data')) {
        component = 'Date';
      } else if (input.hasClass('make-switch') || type === 'checkbox') {
        component = 'Switch';
      } else if (input.hasClass('mascara-inteiro') || input.hasClass('mascara-decimal')) {
        component = 'Number';
      }
      
      metadata.fields.push({
        key: name,
        label: label || name,
        component,
        type,
        required: !!required,
        maxLength: maxLength ? parseInt(maxLength) : null
      });
    }
  });

  // Salvar JSON
  const jsonPath = path.join(baseDir, `${config.tela}_metadata.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(metadata, null, 2));
  
  console.log(`   ✅ Metadata extraído: ${metadata.tabs.length} abas, ${metadata.fields.length} campos`);
  console.log(`   💾 Salvo em: ${jsonPath}`);
  
  return metadata;
}

// Executar automaticamente se chamado diretamente
if (require.main === module) {
  const config = require('./capture/@Config/index.js');
  extractMetadata(config);
}

module.exports = { extractMetadata };

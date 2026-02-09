const fs = require('fs');
const cheerio = require('cheerio');
const path = require('path');

// Ler HTML diretamente
const htmlPath = path.join(__dirname, 'output/html/CRM/Movimento/form/Contas_form_9.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

const result = {
  module: 'CRM',
  menu: 'Movimento',
  screen: 'Contas',
  modelName: '',
  tabs: [],
  fields: []
};

// 1. Extrair Model Name
const formEl = $('form[model-name]').first();
if (formEl.length) {
  result.modelName = formEl.attr('model-name').split('.').pop();
}

// 2. Extrair TODAS as abas (inclusive hidden)
$('ul#frmContaTab li').each((i, el) => {
  const link = $(el).find('a').first();
  const name = link.text().trim().split(':')[0].trim();
  const href = link.attr('href');
  const tabId = href ? href.replace('#', '') : null;
  
  if (tabId && name) {
    result.tabs.push({ name, id: tabId });
  }
});

// 3. Extrair campos do formulário principal (tab Principal)
const mainForm = $('form').first();
mainForm.find('.form-group').each((i, el) => {
  const label = $(el).find('label').first().text().trim();
  const input = $(el).find('input, select, textarea').first();
  
  if (input.length) {
    const name = input.attr('name');
    const id = input.attr('id');
    const type = input.attr('type') || input.prop('tagName').toLowerCase();
    
    // Pular campos ocultos e técnicos
    if (type === 'hidden' || !name || name === 'undefined' || $(el).hasClass('display-none')) return;
    
    const required = input.attr('data-obrigatorio') === 'true' || input.attr('required') === 'required';
    const maxLength = input.attr('maxlength');
    
    // Detectar componente
    let component = 'InputText';
    if (input.is('select')) {
      component = input.attr('data-url_dados') || input.hasClass('select2') ? 'Select' : 'Select';
    } else if (input.is('textarea')) {
      component = 'TextArea';
    } else if (input.hasClass('mascara-data')) {
      component = 'Date';
    } else if (input.hasClass('make-switch') || type === 'checkbox') {
      component = 'Switch';
    } else if (input.hasClass('mascara-inteiro')) {
      component = 'Number';
    } else if (input.hasClass('mascara-decimal')) {
      component = 'Decimal';
    }
    
    result.fields.push({
      key: name,
      label: label || name,
      component,
      type,
      required: !!required,
      maxLength: maxLength ? parseInt(maxLength) : null
    });
  }
});

// Salvar resultado
console.log(JSON.stringify(result, null, 2));

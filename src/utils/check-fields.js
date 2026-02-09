const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('../output/Form/cadastro_id_9.html', 'utf8');
const $ = cheerio.load(html);

console.log('\n=== Buscando todas as abas ===\n');

// Buscar lista de abas
const tabList = $('ul.nav-tabs').first();
const tabs = [];

tabList.find('li').each((i, el) => {
    const link = $(el).find('a').first();
    const name = link.text().trim().split(':')[0].trim();
    const href = link.attr('href');
    const tabId = href ? href.replace('#', '') : null;
    
    console.log(`Aba ${i+1}: "${name}" -> ID: ${tabId}`);
    tabs.push({ name, tabId });
});

console.log(`\n=== Extraindo campos da aba "Contatos" (${tabs.find(t => t.name === 'Contatos')?.tabId}) ===\n`);

const contatosTabId = tabs.find(t => t.name === 'Contatos')?.tabId;
if (contatosTabId) {
    const container = $(`#${contatosTabId}`);
    console.log(`Container encontrado: ${container.length > 0 ? 'SIM' : 'NÃO'}`);
    
    const fields = [];
    container.find('input, select, textarea').each((i, el) => {
        const input = $(el);
        const name = input.attr('name');
        const type = input.attr('type') || input.prop('tagName').toLowerCase();
        const label = input.closest('.form-group').find('label').first().text().trim();
        
        if (name && name !== 'undefined' && type !== 'hidden') {
            fields.push({ name, label, type });
        }
    });
    
    console.log(`Total de campos: ${fields.length}\n`);
    fields.forEach(f => {
        console.log(`- ${f.name} (${f.label}) - ${f.type}`);
    });
}

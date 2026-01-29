const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const HTML_FILE = 'C:/Users/Ryan.nunes/Desktop/Nova pasta/output/Form/cadastro_id_9.html';

if (!fs.existsSync(HTML_FILE)) {
    console.error('Arquivo HTML não encontrado:', HTML_FILE);
    process.exit(1);
}

const html = fs.readFileSync(HTML_FILE, 'utf-8');
const $ = cheerio.load(html);

const actions = [];

// 1. Buttons
$('button').each((i, el) => {
    const $el = $(el);
    actions.push({
        type: 'button',
        text: $el.text().trim(),
        id: $el.attr('id'),
        class: $el.attr('class'),
        onclick: $el.attr('onclick'),
        html: $el.prop('outerHTML').substring(0, 100) + '...'
    });
});

// 2. Input type=button/submit
$('input[type="button"], input[type="submit"], input[type="reset"]').each((i, el) => {
    const $el = $(el);
    actions.push({
        type: 'input-button',
        value: $el.val(),
        id: $el.attr('id'),
        class: $el.attr('class'),
        onclick: $el.attr('onclick'),
        html: $el.prop('outerHTML').substring(0, 100) + '...'
    });
});

// 3. Links with href="#" or javascript: or onclick
$('a').each((i, el) => {
    const $el = $(el);
    const href = $el.attr('href');
    const onclick = $el.attr('onclick');
    
    // Filter relevant links
    if (onclick || (href && (href === '#' || href.startsWith('javascript:')))) {
         actions.push({
            type: 'link-action',
            text: $el.text().trim(),
            id: $el.attr('id'),
            class: $el.attr('class'),
            href: href,
            onclick: onclick,
            html: $el.prop('outerHTML').substring(0, 100) + '...'
        });
    }
});

// 4. Any element with onclick (that wasn't caught above)
$('[onclick]').each((i, el) => {
    const $el = $(el);
    if (!$el.is('button') && !$el.is('input') && !$el.is('a')) {
        actions.push({
            type: 'element-onclick',
            tag: el.tagName,
            text: $el.text().trim(),
            id: $el.attr('id'),
            class: $el.attr('class'),
            onclick: $el.attr('onclick'),
            html: $el.prop('outerHTML').substring(0, 100) + '...'
        });
    }
});

// 5. Scripts (extract functions that look like actions?)
// This is hard to do reliably without parsing JS, sticking to DOM elements for now.

const REPORT_FILE = 'actions_report.txt';
// Clear file
fs.writeFileSync(REPORT_FILE, '## Ações Encontradas no Formulário\n\n', 'utf-8');

function log(msg) {
    fs.appendFileSync(REPORT_FILE, msg + '\n', 'utf-8');
}

if (actions.length === 0) {
    log('Nenhuma ação explícita encontrada (buttons, links, onclicks).');
} else {
    // Group by Text/Value to dedup
    const uniqueActions = new Map();
    actions.forEach(a => {
        const key = (a.text || a.value || 'sem-texto') + '-' + (a.onclick || a.href || 'sem-acao');
        if (!uniqueActions.has(key)) {
            uniqueActions.set(key, a);
        }
    });

    log(`Total encontrado: ${actions.length}. Únicos: ${uniqueActions.size}\n`);

    uniqueActions.forEach((action, key) => {
        log(`### [${action.type.toUpperCase()}] ${action.text || action.value || 'N/A'}`);
        if(action.id) log(`- **ID:** ${action.id}`);
        if(action.onclick) log(`- **OnClick:** \`${action.onclick}\``);
        if(action.href) log(`- **Href:** \`${action.href}\``);
        if(action.class) log(`- **Class:** \`${action.class}\``);
        log('');
    });
}
console.log(`Relatório salvo em ${REPORT_FILE}`);

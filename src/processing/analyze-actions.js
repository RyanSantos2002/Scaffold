const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const HTML_FILE = 'C:/Users/Ryan.nunes/Desktop/Nova pasta/output/Form/cadastro_id_9.html';
const OUTPUT_FILE = 'regras_negocio_Contas.md';

if (!fs.existsSync(HTML_FILE)) {
    console.error('Arquivo HTML não encontrado:', HTML_FILE);
    process.exit(1);
}

const html = fs.readFileSync(HTML_FILE, 'utf-8');
const $ = cheerio.load(html);

const actions = [];
const businessRules = [];

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

// 5. Ajax Calls Analysis (Regex)
// Patterns: Ajax.post, RequisicaoAjax, $.post, $.ajax
const ajaxPatterns = [
    { name: 'Ajax.post', regex: /Ajax\.post\s*\(\s*['"]([^'"]+)['"]/g },
    { name: 'RequisicaoAjax', regex: /RequisicaoAjax\s*\(\s*['"]([^'"]+)['"]/g },
    { name: '$.post', regex: /\$\.post\s*\(\s*['"]([^'"]+)['"]/g },
    { name: '$.ajax', regex: /\$\.ajax\s*\(\s*\{[^}]*url\s*:\s*['"]([^'"]+)['"]/g }
];

ajaxPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.regex.exec(html)) !== null) {
        businessRules.push({
            type: 'ajax-call',
            method: pattern.name,
            url: match[1],
            context: html.substring(Math.max(0, match.index - 50), Math.min(html.length, match.index + 100)).replace(/\s+/g, ' ').trim()
        });
    }
});

// Write Markdown Report
fs.writeFileSync(OUTPUT_FILE, '# Relatório de Regras e Ações da Tela (Contas)\n\n', 'utf-8');

function log(msg) {
    fs.appendFileSync(OUTPUT_FILE, msg + '\n', 'utf-8');
}

log(`**Arquivo Analisado:** \`${HTML_FILE}\`\n`);

log('## 1. Ações Identificadas (Botões e Links)\n');

if (actions.length === 0) {
    log('_Nenhuma ação explícita encontrada (buttons, links, onclicks)._');
} else {
    // Group by Text/Value to dedup
    const uniqueActions = new Map();
    actions.forEach(a => {
        const key = (a.text || a.value || 'sem-texto') + '-' + (a.onclick || a.href || 'sem-acao');
        if (!uniqueActions.has(key)) {
            uniqueActions.set(key, a);
        }
    });

    log(`_Total encontrado: ${actions.length}. Únicos: ${uniqueActions.size}_\n`);

    uniqueActions.forEach((action, key) => {
        log(`### [${action.type.toUpperCase()}] ${action.text || action.value || 'N/A'}`);
        if(action.id) log(`- **ID:** \`${action.id}\``);
        if(action.onclick) log(`- **OnClick:** \`${action.onclick}\``);
        if(action.href) log(`- **Href:** \`${action.href}\``);
        if(action.class) log(`- **Class:** \`${action.class}\``);
        log('');
    });
}

log('\n## 2. Chamadas Ajax e Regras de Negócio (Backend)\n');

if (businessRules.length === 0) {
    log('_Nenhuma chamada Ajax explícita encontrada via regex._');
} else {
    // Dedup business rules based on URL
    const uniqueRules = new Map();
    businessRules.forEach(r => {
        if (!uniqueRules.has(r.url)) {
            uniqueRules.set(r.url, r);
        }
    });

    uniqueRules.forEach((rule) => {
        log(`### URL: \`${rule.url}\``);
        log(`- **Método Detectado:** \`${rule.method}\``);
        log(`- **Contexto:** \`...${rule.context}...\``);
        
        // Try to guess Controller/Action
        const parts = rule.url.split('/').filter(p => p && p !== '..');
        if (parts.length >= 2) {
             const action = parts.pop();
             const controller = parts.pop();
             // Sometimes area is involved, but usually last two are Controller/Action
             log(`- **Possível Controller:** \`${controller}\``);
             log(`- **Possível Action:** \`${action}\``);
        }
        log('');
    });
}
console.log(`Relatório salvo em ${OUTPUT_FILE}`);

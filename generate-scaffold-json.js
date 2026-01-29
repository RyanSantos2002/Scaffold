const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Load HTML
const htmlPath = path.join(__dirname, 'output', 'html', 'CRM', 'Movimento', 'form', 'Contas_form_9.html');
if (!fs.existsSync(htmlPath)) {
    console.error("HTML file not found:", htmlPath);
    process.exit(1);
}

const html = fs.readFileSync(htmlPath, 'utf8');
const $ = cheerio.load(html);

const payload = {
    createInModule: 'CRM',
    tabs: []
};

// 1. Principal Tab
const mainForm = $('form[model-name]').first();
const mainModelName = mainForm.attr('model-name') ? mainForm.attr('model-name').split('.').pop() : 'ContaModelo';

payload.tabs.push({
    name: 'Principal',
    modelName: mainModelName,
    hasGrid: false, // Principal usually is the form itself, grid is in the list
    hasForm: true
});

// 2. Other Tabs
$('ul#frmContaTab li').each((i, el) => {
    const link = $(el).find('a').first();
    const name = link.text().trim().split(':')[0].trim();
    const href = link.attr('href');
    const id = href ? href.replace('#', '') : '';
    
    if (id === 'principalContas' || !name) return; // Skip Principal (handled above)
    
    const onClick = $(el).attr('onclick') || '';
    let gridName = '';
    
    // Extract grid name from AcaoGridExecutarCliqueAba(this, ['tblName'], ...)
    const match = onClick.match(/\['(.*?)'\]/);
    if (match) {
        gridName = match[1];
    }
    
    // Guess Model Name from Grid Name
    // tblDetalhePessoaEndereco -> PessoaEnderecoModelo
    // tblDetalheContaContato -> ContaContatoModelo
    let modelName = 'UnknownModelo';
    if (gridName) {
        let cleanName = gridName.replace('tblDetalhe', '').replace('tbl', '');
        modelName = cleanName + 'Modelo';
    }

    payload.tabs.push({
        name: name,
        modelName: modelName,
        hasGrid: !!gridName,
        hasForm: true // Default to true, assume standard master-details
    });
});

console.log(JSON.stringify(payload, null, 2));

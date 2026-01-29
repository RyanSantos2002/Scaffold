const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Import configuration dynamically
const configPath = path.resolve(__dirname, 'capture', '@Config', 'index.js');
if (!fs.existsSync(configPath)) {
    console.error("Configuration file not found at " + configPath);
    process.exit(1);
}
const config = require(configPath);

// Dynamic Input Directory
// ../output/Form (onde engine.js salvou)
const inputDir = path.resolve(__dirname, '..', 'output', 'Form');

// Dynamic Output Directory
// ../output/json/{config.tela}
const outputBaseDir = path.resolve(__dirname, '..', 'output', 'json', config.tela);

function findHtmlFile() {
    if (!fs.existsSync(inputDir)) return null;
    const files = fs.readdirSync(inputDir);
    return files.find(f => f.endsWith('.html'));
}

function run() {
    const htmlFile = findHtmlFile();
    if (!htmlFile) {
        console.error("HTML file not found in " + inputDir);
        return;
    }

    const filePath = path.join(inputDir, htmlFile);
    console.log(`Processing: ${filePath}`);
    const html = fs.readFileSync(filePath, 'utf8');
    const $ = cheerio.load(html);

    // 1. Get Main Model Name
    // We can try to use config.tela or config.keywordUrl if needed, but parsing HTML is safer for the specific ID
    // However, if the key is generic, we might need a better selector.
    // For now, let's stick to the heuristic or find the first form with model-name.
    
    const form = $('form[model-name]').first(); 
    const fullModelName = form.attr('model-name') || "";
    // "M8.Florestal.Visual.Web.Modelos.Crm.ContaModelo" -> "ContaModelo"
    const mainModelName = fullModelName.split('.').pop();
    
    // 2. Identify Tabs
    const tabs = [];
    // Can we rely on #frmContaTab? If the form ID changes, this breaks.
    // Better to find the ul with class "nav nav-tabs" or similar inside the form-like structure
    // But for this legacy structure, usually ID matches form.
    // Let's try to find the tab container relative to the form or just generally.
    let tabContainer = $('#' + form.attr('id') + 'Tab');
    if (tabContainer.length === 0) {
        // Fallback: finding any nav-tabs
        tabContainer = $('.nav.nav-tabs').first();
    }

    tabContainer.find('li a').each((i, el) => {
        const anchor = $(el);
        let name = anchor.text().trim();
        const href = anchor.attr('href');
        const id = href ? href.replace('#', '') : "";
        
        const li = anchor.parent();
        const onclick = li.attr('onclick') || "";
        let gridId = null;
        const match = onclick.match(/AcaoGridExecutarCliqueAba\(.*?\['(.*?)'\]/); 
        if (match) {
            gridId = match[1];
        }

        let hasGrid = !!gridId;
        if (i === 0) hasGrid = true;
        
        let hasForm = true; 

        // Refine hasForm logic
        if (hasGrid) {
            const gridRegex = new RegExp(`jQuery\\(["']#${gridId}["']\\)\\.kendoGrid\\(\\{`, 'i');
            const gridMatch = html.match(gridRegex);
            
            if (gridMatch) {
                const searchContext = html.substring(gridMatch.index, gridMatch.index + 5000);
                if (searchContext.includes('btn-editar-listagem') || searchContext.includes('title=\\"Editar\\"')) {
                    hasForm = true;
                } else {
                    hasForm = false;
                }
            } else {
                hasForm = false; 
            }
        } else {
            if (id) {
                const tabPane = $(`#${id}`);
                if (tabPane.length > 0 && tabPane.find('form').length > 0) {
                     hasForm = true;
                } else {
                     hasForm = false;
                     // Special case: Principal/First tab usually HAS a form if it's the main container
                     // If index is 0, default true?
                     if (i === 0) hasForm = true;
                }
            }
        }

        // Infer Model Name
        let modelName = "";
        if (gridId) {
             let inferred = gridId.replace(/^tbl/, '');
             if (inferred.startsWith('Detalhe')) {
                 inferred = inferred.replace('Detalhe', '');
             }
             modelName = inferred + "Modelo";
        } else if (i === 0) {
             modelName = mainModelName;
             
             // First Tab Naming Rule: 
             let cleanName = mainModelName.replace(/Modelo$/, '');
             // Use Title Case (First letter uppercase, rest lowercase if desired, or just preserve casing?)
             // User said "primeiro letra maisucula", implies "Conta"
             name = cleanName.charAt(0).toUpperCase() + cleanName.slice(1).toLowerCase();
        }

        if (name) {
            tabs.push({
                name,
                modelName: modelName || "",
                hasGrid,
                hasForm
            });
        }
    });

    const output = {
        createInModule: config.modulo,
        tabs: tabs
    };

    // Prepare Output
    if (!fs.existsSync(outputBaseDir)) {
        fs.mkdirSync(outputBaseDir, { recursive: true });
    }

    const outputFileName = `${config.tela}.json`;
    const outputPath = path.join(outputBaseDir, outputFileName);
    
    // Check if we need to wrap it in a root object or just list? 
    // User format seems to be just the object.
    
    const finalJson = JSON.stringify(output, null, 2);
    console.log(`Writing JSON to ${outputPath}`);
    fs.writeFileSync(outputPath, finalJson);
    console.log("JSON Output:");
    console.log(finalJson);
}

run();

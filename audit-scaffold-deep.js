const fs = require('fs');
const path = require('path');

// Configuração Básica
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = __dirname;
const CONFIG_PATH = path.join(CAPTURE_DIR, 'capture', '@Config', 'index.js');
const OUTPUT_DIR = path.join(CAPTURE_DIR, 'auditoria_outputs');

// Utils
const camelCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '');
const kebabCase = (str) => str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

function audit() {
    console.log("Starting Audit...");
    
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error("Config not found!");
        return;
    }
    const config = require(CONFIG_PATH);
    const moduleLower = config.modulo.toLowerCase();
    const screenKebab = kebabCase(config.tela);
    
    // Path resolution
    
    // Tenta encontrar diretório do módulo (Case Insensitive)
    const srcDirEntries = fs.readdirSync(FRONT_SRC, { withFileTypes: true });
    const moduleEntry = srcDirEntries.find(dirent => dirent.isDirectory() && dirent.name.toLowerCase() === `@${moduleLower}`);
    const moduleDirName = moduleEntry ? moduleEntry.name : `@${config.modulo}`; // Fallback

    // Tenta encontrar diretório da página (Singular ou Plural)
    const pagesBasePath = path.join(FRONT_SRC, moduleDirName, 'pages');
    let pageDirName = screenKebab; 

    if (fs.existsSync(pagesBasePath)) {
        const pageEntries = fs.readdirSync(pagesBasePath, { withFileTypes: true });
        // Tenta exato com kebabCase
        let foundPage = pageEntries.find(d => d.isDirectory() && d.name === screenKebab);
        
        if (!foundPage) {
            // Tenta singular
            const singularName = screenKebab.replace(/s$/, '');
            foundPage = pageEntries.find(d => d.isDirectory() && d.name === singularName);
            if (foundPage) pageDirName = foundPage.name;
        } else {
            pageDirName = foundPage.name;
        }
    }
    
    let pagesDir = path.join(FRONT_SRC, moduleDirName, 'pages', pageDirName);
    
    const paths = {
        metadata: path.join(CAPTURE_DIR, '..', 'output', 'html', config.modulo, config.menuPai, `${config.tela}_metadata.json`),
        pagesDir: path.join(pagesDir, 'form'),
    };
    
    const reportPath = path.join(OUTPUT_DIR, `auditoria_automatica_${config.tela}.md`);
    
    console.log(`Auditing Screen: ${config.tela} (${config.modulo})`);
    console.log(`Metadata: ${paths.metadata}`);
    
    if (!fs.existsSync(paths.metadata)) {
        console.error("Metadata not found!");
        return;
    }

    const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf-8'));
    const reportLines = [];
    
    reportLines.push(`# Auditoria Profunda: ${config.modulo} / ${config.tela}`);
    reportLines.push(`**Data:** ${new Date().toLocaleString()}\n`);

    for (const tab of metadata.tabs) {
        try {
            console.log(`Checking Tab: ${tab.name}`);
            reportLines.push(`## Aba: ${tab.name}`);

            const tabVariations = [
                path.join(paths.pagesDir, 'tabs', 'index.tsx'),
                path.join(paths.pagesDir, 'tabs', kebabCase(tab.name), 'index.tsx'),
                path.join(paths.pagesDir, 'tabs', screenKebab.replace(/s$/, ''), 'form', 'tabs', kebabCase(tab.name), 'index.tsx'), // fallback weird path
                path.join(paths.pagesDir, 'tabs', `${kebabCase(tab.name)}.tsx`)
            ];
            
            // Special case for Enderecos common folder name issue
            if (tab.name.includes('Endereço')) {
                tabVariations.push(path.join(paths.pagesDir, 'tabs', 'enderecos', 'index.tsx'));
            }

            let tabFile = null;
            if (metadata.tabs.indexOf(tab) === 0 && fs.existsSync(tabVariations[0])) {
                tabFile = tabVariations[0];
            } else {
                for (const p of tabVariations.slice(1)) {
                    if (fs.existsSync(p)) {
                        tabFile = p;
                        break;
                    }
                }
            }

            if (!tabFile) {
                reportLines.push(`- ❌ **Arquivo da Aba não encontrado**`);
                continue;
            }
            reportLines.push(`- ✅ Arquivo: \`${tabFile}\``);
            const tabContent = fs.readFileSync(tabFile, 'utf-8');

            // Model Check
            const modelMatch = tabContent.match(/model:\s*([A-Za-z0-9]+)/);
            let modelName = modelMatch ? modelMatch[1] : null;

            if (modelName) {
                reportLines.push(`- ℹ️ Model Detectado: \`${modelName}\``);
                // Try to find model file
                const importRegex = new RegExp(`import\\s+.*${modelName}.*from\\s+['"]@/(.*)['"]`);
                const importMatch = tabContent.match(importRegex);
                
                if (importMatch) {
                    const modelPath = path.join(FRONT_SRC, importMatch[1] + '.ts'); // assumes .ts
                    if (fs.existsSync(modelPath)) {
                    const modelContent = fs.readFileSync(modelPath, 'utf-8');
                    const missing = [];
                    
                    // Fields are usually flat in metadata, so we check them only for the main form or if we have mapping
                    // Logic updated: use metadata.fields for the first tab
                    const fieldsToCheck = (metadata.tabs.indexOf(tab) === 0) ? metadata.fields : [];
                    
                    if (fieldsToCheck && fieldsToCheck.length > 0) {
                         fieldsToCheck.forEach(field => {
                            let propName = camelCase(field.key); // Use Key
                            if (propName === 'codigo' || field.key === 'Id') propName = 'id';

                            // Verifica se existe no model
                            if (!modelContent.includes(`${propName}?`) && !modelContent.includes(`${propName}:`)) {
                                missing.push(propName);
                            }
                        });
                        
                        if (missing.length > 0) {
                            reportLines.push(`- ❌ **Campos Faltantes no Model (${missing.length}):**`);
                            missing.forEach(m => reportLines.push(`  - [ ] \`${m}\``));
                        } else {
                            reportLines.push(`- ✅ Todos os campos detectados no Model.`);
                        }
                    } else {
                        reportLines.push(`- ℹ️ Validação de campos ignorada para esta aba (sem campos mapeados).`);
                    }
                } else {
                        reportLines.push(`- ⚠️ Arquivo de Model não encontrado no disco: ${modelPath}`);
                    }
                }
            } else {
                reportLines.push(`- ⚠️ Model não identificado no arquivo da aba.`);
            }
            reportLines.push('\n');
        } catch (errInner) {
            console.error(`Error processing tab ${tab.name}:`, errInner);
            reportLines.push(`- ❌ Erro ao processar aba: ${errInner.message}`);
        }
    }

    fs.writeFileSync(reportPath, reportLines.join('\n'));
    console.log(`Report saved: ${reportPath}`);
}

try {
    audit();
} catch (e) {
    console.error("Fatal Error:", e);
}

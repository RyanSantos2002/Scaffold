const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

// Configuração Básica
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = __dirname;
const CONFIG_PATH = path.join(CAPTURE_DIR, 'capture', '@Config', 'index.js');

const STANDARD_FIELDS = ['id', 'ativo', 'usuarioCadastrouId', 'excluidoPeloUsuarioId', 'atualizadoPeloUsuarioId', 'estaExcluido', 'dataCadastro', 'dataAtualizacao'];

// Utilitários de String
const normalizeText = (text) => text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim() : "";
const camelCase = (str) => normalizeText(str).replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
const pascalCase = (str) => normalizeText(str).replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
const kebabCase = (str) => str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');

// Carregar Configuração
if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Configuração não encontrada em: ${CONFIG_PATH}`);
    process.exit(1);
}
const config = require(CONFIG_PATH);
const MODULE = config.modulo;
const SCREEN = config.tela;

// 1. Localizar HTML Fonte e Extrair Metadata (Mesma lógica do Audit Enhanced)
// Novo caminho: output/Form (onde engine.js salva)
const htmlDir = path.join(CAPTURE_DIR, '..', 'output', 'Form');
let htmlFile = null;
if (fs.existsSync(htmlDir)) {
    const files = fs.readdirSync(htmlDir);
    // Procura por qualquer arquivo HTML (ex: cadastro_id_9.html)
    const found = files.find(f => f.endsWith('.html'));
    if (found) htmlFile = path.join(htmlDir, found);
}

if (!htmlFile) {
    console.error(`HTML Fonte não encontrado em ${htmlDir}`);
    process.exit(1);
}

console.log(`Fixing Screen: ${SCREEN} (${MODULE}) using HTML: ${path.basename(htmlFile)}`);
const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
const $ = cheerio.load(htmlContent);

function extractDeepMetadata() {
    const tabsData = [];
    
    let tabList = $('ul#frmContaTab, ul.nav-tabs, ul.tabbable').first();
    const tabsFound = [];

    if (tabList.length) {
        tabList.find('li').each((i, el) => {
            const link = $(el).find('a').first();
            const rawName = link.text().trim();
            const name = rawName.split(':')[0].trim();
            const href = link.attr('href');
            const tabId = href ? href.replace('#', '') : null;
            const onClick = $(el).attr('onclick') || link.attr('onclick') || "";

            tabsFound.push({ index: i, name, id: tabId, onClick, rawName });
        });
    } else {
        tabsFound.push({ index: 0, name: 'Principal', id: 'main-content', onClick: '', rawName: 'Principal' });
    }

    tabsFound.forEach(tab => {
        const tabInfo = {
            name: tab.name,
            fields: [],
            hasGrid: false
        };

        if (tab.onClick && (tab.onClick.includes('AcaoGrid') || tab.onClick.includes('tbl'))) {
            tabInfo.hasGrid = true;
        }

        let container = tab.id && tab.id !== 'main-content' ? $(`#${tab.id}`) : $('body');
        if (tab.id && container.length === 0) container = $(`.tab-pane#${tab.id}`);

        if (container.length) {
            container.find('input, select, textarea').each((j, inp) => {
                const input = $(inp);
                const name = input.attr('name');
                const type = input.attr('type') || input.prop('tagName').toLowerCase();

                if (!name || type === 'hidden' || name === 'undefined') return;

                const label = input.closest('.form-group').find('label').first().text().trim() || name;
                const required = input.attr('required') || input.attr('data-obrigatorio') === 'true';
                const maxLength = input.attr('maxlength');
                
                const fieldObj = {
                    key: name,
                    label: label,
                    type: type,
                    required: !!required,
                    maxLength: maxLength
                };

                tabInfo.fields.push(fieldObj);
            });
        }
        
        tabsData.push(tabInfo);
    });

    return tabsData;
}

const tabsData = extractDeepMetadata();

// 2. Localizar Diretórios do Projeto
const modelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', MODULE.toLowerCase());
let pageDirName = kebabCase(SCREEN);
const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
if (!fs.existsSync(path.join(pagesBase, pageDirName))) {
     pageDirName = pageDirName.replace(/s$/, ''); 
}
const tabsDir = path.join(pagesBase, pageDirName, 'form', 'tabs');

// 3. Função de Correção de Model
function fixModelForTab(tab, tabNamePascal) {
    if (tab.fields.length === 0) return null; // Sem campos, não há o que corrigir

    // Determine Model Name - Buscar arquivo existente
    let modelPath = null;
    let modelName = '';
    let screenPascal = pascalCase(SCREEN);
    
    if (tab.name === 'Principal' || tab.name === 'Conta') {
        // Tenta kebab-case primeiro, depois PascalCase para compatibilidade
        const screenKebab = kebabCase(SCREEN).replace(/s$/, ''); // 'conta'
        const possibilities = [
            `${screenKebab}.ts`,                         // conta.ts (PRIORITÁRIO)
            `${screenPascal.slice(0, -1)}Modelo.ts`,     // ContaModelo.ts
            `${screenPascal}Modelo.ts`                   // ContasModelo.ts
        ];
        
        for (const name of possibilities) {
            const tryPath = path.join(modelsDir, name);
            if (fs.existsSync(tryPath)) {
                modelPath = tryPath;
                modelName = name;
                break;
            }
        }
    } else {
        // Para outras abas, tenta kebab-case primeiro
        const cleanScreen = screenPascal.slice(0, -1); // Conta
        const screenKebab = kebabCase(SCREEN).replace(/s$/, ''); // conta
        const tabKebab = kebabCase(normalizeText(tab.name)); // contatos, anexos, etc
        const tabKebabSingular = tabKebab.replace(/s$/, ''); // contato, anexo
        const possibilities = [
            `${screenKebab}-${tabKebabSingular}.ts`,             // conta-contato.ts (PRIORITÁRIO - SINGULAR)
            `${screenKebab}-${tabKebab}.ts`,                     // conta-contatos.ts
            `${screenKebab}-${tabKebabSingular.split('-').reverse().join('-')}.ts`, // conta-empresa-grupo.ts (REVERSO)
            `${tabKebabSingular}.ts`,                            // contato.ts
            `${tabKebab}.ts`,                                    // contatos.ts
            `${cleanScreen}${tabNamePascal}Modelo.ts`,           // ContaEnderecoModelo
            `${cleanScreen}${tabNamePascal}sModelo.ts`,          // ContaEnderecosModelo
            `${tabNamePascal}Modelo.ts`,                         // EnderecoModelo
            `${tabNamePascal}sModelo.ts`                         // EnderecosModelo
        ];
        
        for (const name of possibilities) {
            const tryPath = path.join(modelsDir, name);
            if (fs.existsSync(tryPath)) {
                modelPath = tryPath;
                modelName = name;
                break;
            }
        }
    }
    
    // Se não encontrou o modelo, retorna false
    if (!modelPath) {
        console.warn(`⚠️ [Model] Modelo não encontrado para aba "${tab.name}". Pulando injeção de campos.`);
        return false;
    }
    
    console.log(`🔍 [Model] Verificando modelo: ${modelName}`);
    
    // Inject Fields and Mappings
    let content = fs.readFileSync(modelPath, 'utf-8');
    let propModifications = [];
    let mappingModifications = [];
    let fieldsInjected = 0;

    // Check for fieldMappingKeys block
    let hasMappingBlock = content.includes('fieldMappingKeys = {');
    
    // Ensure "import type { select2 }..." exists if we need it
    if (!content.includes("import type { select2 }")) {
         content = "import type { select2 } from '@/common/core/types/select2';\n" + content;
    }

    // LIST OF ALL FIELDS TO PROCESS: FROM HTML + EXISTING IN FILE
    const fieldsToProcess = [...tab.fields];

    // Scan content for existing properties ending in "Id" that might not be in HTML
    const idPropRegex = /(\w+Id)\??\s*:/g;
    let match;
    while ((match = idPropRegex.exec(content)) !== null) {
        const existingKey = match[1];
        if (!fieldsToProcess.find(f => camelCase(f.key) === existingKey) && !STANDARD_FIELDS.includes(existingKey)) {
             fieldsToProcess.push({
                 key: existingKey,
                 type: 'number', // Assume number for Id
                 required: false,
                 maxLength: null
             });
        }
    }

    fieldsToProcess.forEach(field => {
        let originalKey = field.key;
        let camelKey = camelCase(originalKey);
        let pascalKey = pascalCase(originalKey);
        
        // Logic for Select2 (Foreign Keys endings in Id)
        let isSelect2 = false;
        let propName = camelKey;

        if (camelKey.endsWith('Id') && camelKey.length > 2 && !STANDARD_FIELDS.includes(camelKey)) {
             // Assume Select2
             isSelect2 = true;
             propName = camelKey.slice(0, -2); // remove Id
        }
        
        if (STANDARD_FIELDS.includes(camelKey)) return;

        // 1. Check/Add Property
        const propRegex = new RegExp(`${propName}\\??\\s*:`, 'i');
        if (!propRegex.test(content)) {
            let tsType = 'string';
            if (isSelect2) tsType = 'select2';
            else if (field.type === 'number') tsType = 'number';
            else if (field.type === 'checkbox' || field.type === 'boolean') tsType = 'boolean';
            else if (field.type === 'date') tsType = 'Date';

            let decorators = '';
            if (field.required) decorators += `  @Required()\n`;
            if (field.maxLength) decorators += `  @MaxLength(${field.maxLength})\n`;

            propModifications.push(`${decorators}  ${propName}?: ${tsType};`);
            fieldsInjected++;
        }

        // 2. Check/Add Mapping
        // Look for 'propName': or 'propName.id': inside fieldMappingKeys
        // This is a simple heuristic - checking if the key string exists in the file
        // A more robust parser would be ideal but this works for simple cases
        
        if (isSelect2) {
            const mapKeyId = `'${propName}.id'`;
            const mapKeyName = `'${propName}.name'`;
            
            if (!content.includes(mapKeyId)) {
                 mappingModifications.push(`    ${mapKeyId}: '${pascalKey}',`); // vendedor.id: 'VendedorId'
            }
            if (!content.includes(mapKeyName)) {
                 mappingModifications.push(`    ${mapKeyName}: '${pascalCase(propName)}Nome',`); // vendedor.name: 'VendedorNome'
            }
        } else {
             const mapKey = `'${propName}'`;
             // Try to find key in fieldMappingKeys. 
             // Regex: 'propName'\s*:
             const mapRegex = new RegExp(`'${propName}'\\s*:`, 'i');
             const mapRegexSimple = new RegExp(`${propName}\\s*:`, 'i'); // for keys without quotes

             if (!mapRegex.test(content) && !mapRegexSimple.test(content)) {
                 mappingModifications.push(`    ${propName}: '${pascalKey}',`);
             }
        }
    });

    if (propModifications.length > 0 || mappingModifications.length > 0) {
        const lines = content.split('\n');
        
        // Inject Properties
        if (propModifications.length > 0) {
             let insertIdx = lines.findIndex(l => l.includes('constructor'));
             if (insertIdx === -1) {
                 for (let i = lines.length - 1; i >= 0; i--) {
                    if (lines[i].trim() === '}') { insertIdx = i; break; }
                }
             }
             if (lines.findIndex(l => l.includes('// PROPS_HERE')) !== -1) {
                 insertIdx = lines.findIndex(l => l.includes('// PROPS_HERE'));
                 lines.splice(insertIdx, 1, ...propModifications); // Replace placeholder
             } else {
                 lines.splice(insertIdx, 0, ...propModifications);
             }
        }

        // Inject Mappings
        if (mappingModifications.length > 0) {
            let mappingStart = lines.findIndex(l => l.includes('fieldMappingKeys = {'));
            if (mappingStart !== -1) {
                // Find end of block (assuming valid JS/TS structure) or just append after start
                if (lines[mappingStart].includes('// MAPPINGS_HERE')) {
                     lines.splice(mappingStart + 1, 1, ...mappingModifications); // Replace inner placeholder
                } else {
                     lines.splice(mappingStart + 1, 0, ...mappingModifications);
                }
            } else {
                // Determine where to add fieldMappingKeys if it doesn't exist
                // Usually first thing in class
                let classDef = lines.findIndex(l => l.includes('export class'));
                if (classDef !== -1) {
                     const mappingBlock = [
                         '  fieldMappingKeys = {',
                         ...mappingModifications,
                         '  };',
                         ''
                     ];
                     lines.splice(classDef + 1, 0, ...mappingBlock);
                }
            }
        }
        
        let newContent = lines.join('\n');
        
        // Add imports if needed
        if (newContent.includes('@Required') && !newContent.includes('Required }') && !newContent.includes('Required,')) {
            newContent = newContent.replace('import {', 'import { Required,');
        }
        if (newContent.includes('@MaxLength') && !newContent.includes('MaxLength')) {
             newContent = newContent.replace('import {', 'import { MaxLength,');
        }

        fs.writeFileSync(modelPath, newContent);
        console.log(`✅ [Model] Updated ${modelName}: Injected ${propModifications.length} props and ${mappingModifications.length} mappings`);
        return true;
    } else {
        console.log(`✅ [Model] ${modelName} já possui todos os campos e mapeamentos.`);
        return true;
    }
}



function ensureModelExists(filePath, className) {
    if (!fs.existsSync(filePath)) {
        const content = `import { Mapper } from '@/common/core/models/base';
import { Required, MaxLength } from '@/common/core/models/decorators';
import type { AnyObject } from '@/common/core/types/any-object';
import type { select2 } from '@/common/core/types/select2';

export class ${className} extends Mapper {
  fieldMappingKeys = {
    // MAPPINGS_HERE
  };

  // PROPS_HERE

  constructor(json?: AnyObject) {
    super();
    this.map(json);
  }
}
`;
        fs.writeFileSync(filePath, content);
        console.log(`✅ [Model] Created new model: ${className}`);
    }
}

function ensureUIExists(filePath) {
    if (!fs.existsSync(filePath)) {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const content = `import { Forms } from '@/common/components/forms';
import { useTranslation } from 'react-i18next';

export const Index = () => {
    const { t } = useTranslation('${MODULE.toLowerCase()}');
    return (
        <Forms.Simple>
            {/* INJECT_FIELDS_HERE */}
        </Forms.Simple>
    );
};
export default Index;
`;
        fs.writeFileSync(filePath, content);
        console.log(`✅ [UI] Created new UI file: ${path.basename(filePath)}`);
    }
}

// 4. Função de Correção de UI
function fixUIForTab(tab, tabNamePascal) {
    if (tab.fields.length === 0 && !tab.hasGrid) return null; // Sem campos e sem grid

    let uiFilePath = '';
    
    // Find UI File
    if (tab.name === 'Principal' || tab.name === 'Conta') {
         // Prioritize tabs/index.tsx (Actual Form) over form/index.tsx (Wrapper)
         const p1 = path.join(tabsDir, 'index.tsx'); 
         const p2 = path.join(pagesBase, pageDirName, 'form', 'index.tsx');
         
         if (fs.existsSync(p1)) uiFilePath = p1;
         else if (fs.existsSync(p2)) uiFilePath = p2;
    } else {
        const tabFolder = kebabCase(normalizeText(tab.name));
        const p1 = path.join(tabsDir, tabFolder, 'index.tsx');
        const p2 = path.join(tabsDir, tabFolder.replace('s', ''), 'index.tsx');
        
        if (fs.existsSync(p1)) uiFilePath = p1;
        else if (fs.existsSync(p2)) uiFilePath = p2;
    }

    if (!uiFilePath || !fs.existsSync(uiFilePath)) {
        console.warn(`⚠️ [UI] File not found for tab ${tab.name}. Skipping UI injection.`);
        return false; // Arquivo não encontrado
    }

    let content = fs.readFileSync(uiFilePath, 'utf-8');
    let modified = false;

    // Inject Fields
    const fieldsToInject = [];
    tab.fields.forEach(field => {
        let key = camelCase(field.key);
        if (key === 'codigo') key = 'id';
        if (field.key === 'Id') key = 'id';
        if (STANDARD_FIELDS.includes(key)) return;

        // Check existence
        const regex = new RegExp(`register\\(['"]${key}['"]\\)`, 'i'); 
        const controlRegex = new RegExp(`name=["']${key}["']`, 'i');
        
        // Also check for object property (e.g. key="tipoPessoaId", checks "tipoPessoa")
        let objectKeyRegex = null;
        if (key.endsWith('Id')) {
            const objectKey = key.slice(0, -2);
            objectKeyRegex = new RegExp(`register\\(['"]${objectKey}['"]\\)`, 'i');
        }

        if (!regex.test(content) && !controlRegex.test(content) && (!objectKeyRegex || !objectKeyRegex.test(content))) {
            fieldsToInject.push({ key, label: field.label, type: field.type });
        }
    });

        if (fieldsToInject.length > 0) {
        // Find injection point (Form.Wrapper OR Forms.Header OR Forms.Detail)
        let wrapperEnd = content.lastIndexOf('</Form.Wrapper>');
        if (wrapperEnd === -1) wrapperEnd = content.lastIndexOf('</Forms.Header>');
        if (wrapperEnd === -1) wrapperEnd = content.lastIndexOf('</Forms.Detail>');
        if (wrapperEnd === -1) wrapperEnd = content.lastIndexOf('</Forms.Simple>');

        if (wrapperEnd !== -1) {
            let injectHtml = '';
            fieldsToInject.forEach(f => {
                let Component = 'Form.Input';
                let props = `label={t('${camelCase(f.label)}')}`;
                
                if (f.type === 'number' || f.key.endsWith('Id')) {
                    props += ` type="number"`;
                }
                // ... (rest of logic same)
                if (f.type === 'checkbox' || f.type === 'boolean') {
                    Component = 'Form.Checkbox';
                    props = `label={t('${camelCase(f.label)}')}`; 
                }
                if (f.type === 'date') {
                    Component = 'Form.DatePicker';
                }

                injectHtml += `\n        <${Component} name="${f.key}" ${props} />`;
            });

            content = content.slice(0, wrapperEnd) + injectHtml + '\n' + content.slice(wrapperEnd);
            modified = true;
            console.log(`✅ [UI] Injected ${fieldsToInject.length} fields into ${path.basename(uiFilePath)}`);
        } else {
             console.warn(`⚠️ [UI] Could not find insertion point (Form.Wrapper/Header/Detail) in ${path.basename(uiFilePath)}`);
        }
    }

    if (modified) {
        fs.writeFileSync(uiFilePath, content);
        return true;
    }
    return true; // Já OK
}


// --- EXECUÇÃO ---
console.log('--- Starting Enhanced Fix ---');

// Arrays para rastrear arquivos não encontrados
const notFoundModels = [];
const notFoundUIFiles = [];
let modelsFixed = 0;
let uiFilesFixed = 0;

tabsData.forEach(tab => {
    const tabNamePascal = pascalCase(normalizeText(tab.name));
    
    // Tenta corrigir modelo
    if (tab.fields.length > 0) {
        let modelResult = fixModelForTab(tab, tabNamePascal);
        if (modelResult === false) {
            // Se não encontrou, tenta criar
            const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
            const tabKebab = kebabCase(normalizeText(tab.name));
            const newModelName = tab.name === 'Principal' ? `${screenKebab}.ts` : `${screenKebab}-${tabKebab}.ts`;
            const newModelPath = path.join(modelsDir, newModelName);
            const className = pascalCase(newModelName.replace('.ts', ''));
            
            ensureModelExists(newModelPath, className);
            
            // Tenta corrigir novamente após criar
            modelResult = fixModelForTab(tab, tabNamePascal);
             if (modelResult === false) {
                notFoundModels.push({
                    tab: tab.name,
                    expectedNames: [newModelName, ...getExpectedModelNames(tab.name, tabNamePascal)],
                    fieldsCount: tab.fields.length
                });
            } else {
                 modelsFixed++;
            }
        } else {
            modelsFixed++;
        }
    }
    
    // Tenta corrigir UI
    let uiResult = fixUIForTab(tab, tabNamePascal);
    if (uiResult === false) {
        // Se não encontrou, tenta criar
        if (tab.fields.length > 0 || tab.hasGrid) {
             const tabFolder = kebabCase(normalizeText(tab.name));
             const newUIPath = path.join(tabsDir, tabFolder, 'index.tsx');
             
             ensureUIExists(newUIPath);
             
             uiResult = fixUIForTab(tab, tabNamePascal);
             if (uiResult === false) {
                notFoundUIFiles.push({
                    tab: tab.name,
                    expectedPaths: [newUIPath, ...getExpectedUIPaths(tab.name)],
                    fieldsCount: tab.fields.length
                });
             } else {
                 uiFilesFixed++;
             }
        } else {
             // Se não tem campos nem grid, pode ser que não precise de arquivo
             notFoundUIFiles.push({
                tab: tab.name,
                expectedPaths: getExpectedUIPaths(tab.name),
                fieldsCount: tab.fields.length
            });
        }
    } else if (uiResult === true) {
        uiFilesFixed++;
    }
});

// Helper functions para relatório
function getExpectedModelNames(tabName, tabNamePascal) {
    const screenPascal = pascalCase(SCREEN);
    const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
    const tabKebab = kebabCase(normalizeText(tabName));
    
    if (tabName === 'Principal' || tabName === 'Conta') {
        return [
            `${screenKebab}.ts`,
            `${screenPascal.slice(0, -1)}Modelo.ts`,
            `${screenPascal}Modelo.ts`
        ];
    } else {
        const cleanScreen = screenPascal.slice(0, -1);
        return [
            `${screenKebab}-${tabKebab}.ts`,
            `${tabKebab}.ts`,
            `${cleanScreen}${tabNamePascal}Modelo.ts`,
            `${cleanScreen}${tabNamePascal}sModelo.ts`,
            `${tabNamePascal}Modelo.ts`,
            `${tabNamePascal}sModelo.ts`
        ];
    }
}

function getExpectedUIPaths(tabName) {
    const normalizedTab = kebabCase(normalizeText(tabName));
    const paths = [];
    
    if (tabName === 'Principal' || tabName === 'Conta') {
        paths.push('tabs/index.tsx');
    } else {
        paths.push(`tabs/${normalizedTab}/index.tsx`);
        paths.push(`tabs/${normalizedTab.replace('s', '')}/index.tsx`);
    }
    
    return paths;
}

// Run Prettier
try {
    console.log('--- Formatting ---');
    execSync(`npx prettier --write "src/@${MODULE}/**/*.{ts,tsx}"`, { cwd: 'C:/Fontes/FrontM8', stdio: 'inherit' });
} catch (e) {
    console.error('Formatting failed (minor issue)', e.message);
}

console.log('\n✅ Fix Completed.');
console.log(`📊 Resumo: ${modelsFixed} modelos corrigidos, ${uiFilesFixed} arquivos UI corrigidos`);

// Gerar relatório de arquivos não encontrados
if (notFoundModels.length > 0 || notFoundUIFiles.length > 0) {
    const reportLines = [];
    reportLines.push('# Relatório de Arquivos Não Encontrados');
    reportLines.push(`**Tela**: ${SCREEN}`);
    reportLines.push(`**Data**: ${new Date().toLocaleString()}`);
    reportLines.push('');
    
    if (notFoundModels.length > 0) {
        reportLines.push('## Modelos Não Encontrados');
        reportLines.push('');
        notFoundModels.forEach(item => {
            reportLines.push(`### Aba: ${item.tab}`);
            reportLines.push(`- **Campos esperados**: ${item.fieldsCount}`);
            reportLines.push(`- **Nomes tentados**:`);
            item.expectedNames.forEach(name => {
                reportLines.push(`  - \`${name}\``);
            });
            reportLines.push(`- **Diretório**: \`${modelsDir}\``);
            reportLines.push('');
        });
    }
    
    if (notFoundUIFiles.length > 0) {
        reportLines.push('## Arquivos de UI Não Encontrados');
        reportLines.push('');
        notFoundUIFiles.forEach(item => {
            reportLines.push(`### Aba: ${item.tab}`);
            reportLines.push(`- **Campos esperados**: ${item.fieldsCount}`);
            reportLines.push(`- **Caminhos tentados**:`);
            item.expectedPaths.forEach(p => {
                reportLines.push(`  - \`${path.join(pagesBase, pageDirName, 'form', p)}\``);
            });
            reportLines.push('');
        });
    }
    
    reportLines.push('## Ações Recomendadas');
    reportLines.push('');
    reportLines.push('1. **Verificar JSON de entrada**: Confirme se as abas estão corretamente definidas no JSON');
    reportLines.push('2. **Verificar scaffolding**: Execute `/gerar-tela` novamente para garantir que todos os arquivos foram gerados');
    reportLines.push('3. **Verificar nomes**: Os arquivos podem ter nomes ligeiramente diferentes dos esperados');
    reportLines.push('4. **Criar manualmente**: Se necessário, crie os arquivos faltantes seguindo o padrão dos existentes');
    
    const reportPath = path.join(__dirname, 'auditoria_outputs', 'arquivos_nao_encontrados.md');
    if (!fs.existsSync(path.dirname(reportPath))) {
        fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    fs.writeFileSync(reportPath, reportLines.join('\n'));
    
    console.log(`\n📄 Relatório de arquivos não encontrados: ${reportPath}`);
    console.log(`   - ${notFoundModels.length} modelos não encontrados`);
    console.log(`   - ${notFoundUIFiles.length} arquivos UI não encontrados`);
}

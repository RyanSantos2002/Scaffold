const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { execSync } = require('child_process');

// Configuração Básica
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = path.join(__dirname, '..', 'capture');
const CONFIG_PATH = path.join(__dirname, '..', '..', 'capture', '@Config', 'index.js');

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

// Load Generated Files Log
const LOG_PATH = path.join(__dirname, '..', '..', '..', 'Projeto-Scaffolding', 'generated-files.json');
let generatedFiles = [];
if (fs.existsSync(LOG_PATH)) {
    try {
        generatedFiles = JSON.parse(fs.readFileSync(LOG_PATH, 'utf-8')).map(f => f.replace(/\\/g, '/'));
        // Normalize paths to lowercase for easier comparison
        generatedFiles = generatedFiles.map(p => p.toLowerCase().replace(/\/+/g, '/'));
        console.log(`✅ Log de Arquivos Gerados carregado: ${generatedFiles.length} arquivos.`);
    } catch (e) {
        console.warn('⚠️ Erro ao ler generated-files.json:', e.message);
    }
} else {
    console.error('❌ ERRO CRÍTICO: Log de Arquivos Gerados não encontrado em:', LOG_PATH);
    process.exit(1);
}

// 1. Localizar HTML Fonte e Extrair Metadata (Mesma lógica do Audit Enhanced)
const htmlDir = path.join(CAPTURE_DIR, 'output', 'Form');
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

// 1.1 Localizar HTML de Listagem (NOVO)
const listDir = path.join(CAPTURE_DIR, 'output', 'Lista');
let listHtmlFile = null;
if (fs.existsSync(listDir)) {
    const files = fs.readdirSync(listDir);
    const found = files.find(f => f.endsWith('.html'));
    if (found) listHtmlFile = path.join(listDir, found);
}
let listHtmlContent = null;
if (listHtmlFile) {
    console.log(`Grid HTML encontrado: ${path.basename(listHtmlFile)}`);
    listHtmlContent = fs.readFileSync(listHtmlFile, 'utf-8');
}

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

function extractFieldMappingsFromModel(modelContent) {
    const mappings = {};
    if (!modelContent) return mappings;

    // Busca o bloco fieldMappingKeys
    const mappingBlockMatch = modelContent.match(/fieldMappingKeys\s*=\s*\{([\s\S]*?)\s*\};/);
    if (mappingBlockMatch && mappingBlockMatch[1]) {
        const rawBody = mappingBlockMatch[1];
        // Extrai pares 'key': 'Value' ou key: 'Value'
        const regex = /['"]?([\w.[\]]+)['"]?\s*:\s*['"](.+?)['"]/g;
        let m;
        while ((m = regex.exec(rawBody)) !== null) {
            mappings[m[2]] = m[1]; // Inverte: 'EmpresaNome' -> 'empresa.name'
        }
    }
    return mappings;
}

function extractGridColumnsFromListHTML(html) {
    if (!html) return [];
    const $list = cheerio.load(html);
    const columns = [];

    // Tenta 1: Extrair do script inline (Kendo Grid config)
    const scriptContent = html.match(/jQuery\("#tbl[\w]+"\)\.kendoGrid\(\{[\s\S]*?"columns":(\[[\s\S]*?\])/);
    if (scriptContent && scriptContent[1]) {
        try {
            const fieldMatches = scriptContent[1].match(/"field":"([\w.]+)"/g);
            const titleMatches = scriptContent[1].match(/"title":"([\s\S]*?)"/g);

            if (fieldMatches) {
                fieldMatches.forEach((m, i) => {
                    const field = m.split(':')[1].replace(/"/g, '');
                    const title = titleMatches && titleMatches[i] ? titleMatches[i].split(':')[1].replace(/"/g, '') : field;
                    if (field !== 'AcaoBtn') {
                        columns.push({ field, title });
                    }
                });
            }
        } catch (e) {}
    }

    if (columns.length === 0) {
        $list('thead th').each((i, el) => {
            const th = $list(el);
            const field = th.attr('data-field');
            const title = th.text().trim();
            if (field && field !== 'AcaoBtn') {
                columns.push({ field, title });
            }
        });
    }

    return columns;
}

const tabsData = extractDeepMetadata();
const listColumns = extractGridColumnsFromListHTML(listHtmlContent);

// 2. Localizar Diretórios do Projeto
const modelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', MODULE.toLowerCase());
const commonModelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', 'crm'); // Fallback para CRM

// Determinar pageDirName dinamicamente baseado na primeira aba
const firstTabName = tabsData[0]?.name || 'principal';
const pageDirName = kebabCase(normalizeText(firstTabName));

const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
const tabsDir = path.join(pagesBase, pageDirName, 'form', 'tabs');

console.log(`📂 Diretório Pages: ${pagesBase}`);
console.log(`📂 Diretório Tabs: ${tabsDir}`);

// 3. Função de Correção de Model
function fixModelForTab(tab, tabNamePascal) {
    if (tab.fields.length === 0) return null; // Sem campos, não há o que corrigir

    // Determine Model Name - VIA LOG ESTRITO
    let modelPath = null;
    let modelName = '';
    
    // Constrói nome base esperado (kebab-case)
    const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
    
    if (tab.name === 'Principal' || tab.name === 'Conta') {
         // Model Principal
         // Busca exata ou pattern match no log
         // Ex: lancamento-entrada-caixa.ts
         const candidates = generatedFiles.filter(f => 
             f.includes('/models/') && 
             (f.endsWith(`/${screenKebab}.ts`) || f.includes(screenKebab))
         );
         
         // Prioriza match exato de nome de arquivo
         let bestMatch = candidates.find(f => f.endsWith(`/${screenKebab}.ts`));
         if (!bestMatch && candidates.length > 0) bestMatch = candidates[0];

         if (bestMatch && fs.existsSync(bestMatch)) {
             modelPath = bestMatch;
             modelName = path.basename(bestMatch);
         }
    } else {
        // Model Secundário
        const tabKebab = kebabCase(normalizeText(tab.name));
        const tabKebabSingular = tabKebab.replace(/s$/, '');
        const tabSimple = tabKebab.replace(/-de-|-do-|-da-|-dos-|-das-/g, '-');

        // 1. Busca Estrita
        let candidates = generatedFiles.filter(f => 
            f.includes('/models/') && 
            f.includes(screenKebab) && 
            (f.includes(tabKebabSingular) || f.includes(tabKebab))
        );
        
        // 2. Busca Relaxada: Apenas Tab
        if (candidates.length === 0) {
            candidates = generatedFiles.filter(f => 
                f.includes('/models/') && 
                (f.includes(tabKebabSingular) || f.includes(tabSimple) || f.includes(tabKebab.replace(/-/g, '')))
            );
        }

        // 3. Busca por palavras chave
        if (candidates.length === 0) {
             const words = tabKebab.split('-').filter(w => w.length > 2 && !['de','do','da'].includes(w));
             candidates = generatedFiles.filter(f => 
                f.includes('/models/') && 
                words.every(w => f.includes(w))
             );
        }

        if (candidates.length > 0) {
            const best = candidates[0];
            if (fs.existsSync(best)) {
                modelPath = best;
                modelName = path.basename(best);
            }
        }
    }
    
    // Se não encontrou o modelo no LOG, aborta. Não advinha mais.
    if (!modelPath) {
        console.warn(`⚠️ [Model] Modelo não encontrado no LOG para aba "${tab.name}". Pulando fix.`);
        return false; 
    }
    
    console.log(`🔍 [Model] Corrigindo modelo identificado no log: ${modelName}`);
    
    // Inject Fields and Mappings
    let content = fs.readFileSync(modelPath, 'utf-8');
    let propModifications = [];
    let mappingModifications = [];
    let fieldsInjected = 0;

    // Ensure proper imports for decorators and Mapper
    if (!content.includes('extends Mapper')) {
        content = content.replace(/export class (\w+)/, 'export class $1 extends Mapper');
        if (!content.includes("import { Mapper }")) {
            content = "import { Mapper } from '@/common/core/models/base';\n" + content;
        }
    }

    if (!content.includes("import type { select2 }")) {
         content = "import type { select2 } from '@/common/core/types/select2';\n" + content;
    }
    
    // Add Guide standard imports for decorators
    if (!content.includes("import { Required }")) {
        content = "import { Required } from '@/common/helpers/class-validator/required';\n" + content;
    }
    if (!content.includes("import { MaxLength }")) {
        content = "import { MaxLength } from '@/common/helpers/class-validator/max-length';\n" + content;
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
        
        // Pular campos padrão (id, ativo, etc) pois são herdados de Mapper ou da Infra
        if (STANDARD_FIELDS.includes(camelKey)) return; 

        // Logic for Select2 (Foreign Keys endings in Id)
        let isSelect2 = false;
        let propName = camelKey;

        if (camelKey.endsWith('Id') && camelKey.length > 2) {
             // Assume Select2
             isSelect2 = true;
             propName = camelKey.slice(0, -2); // remove Id
        }
        
        if (STANDARD_FIELDS.includes(propName.toLowerCase())) return;

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

    let lines = content.split('\n');
    let hasRedundant = false;
    
    // CLEANUP: Remover ID e Ativo (Padrão FrontM8)
    const originalLineCount = lines.length;
    lines = lines.filter(l => {
        const trimmed = l.trim();
        return !(trimmed.startsWith('id?:') || trimmed.startsWith('ativo?:') || 
                 trimmed.startsWith('id:') || trimmed.startsWith('ativo:'));
    });
    
    // CLEANUP Mapping: Remover id: 'Id' e ativo: 'Ativo'
    lines = lines.filter(l => {
        const trimmed = l.trim();
        return !(trimmed.includes("id: 'Id'") || trimmed.includes("ativo: 'Ativo'") ||
                 trimmed.includes("id:'Id'") || trimmed.includes("ativo:'Ativo'"));
    });
    
    if (lines.length !== originalLineCount) hasRedundant = true;

    if (propModifications.length > 0 || mappingModifications.length > 0 || hasRedundant) {
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



function ensureModelExists(filePath, className, customHeader = '') {
    if (!fs.existsSync(filePath)) {
        let content = `import { Mapper } from '@/common/core/models/base';
// Removed Decorators Import to fix build
// import { Required, MaxLength } from '@/common/core/models/decorators'; 
import type { AnyObject } from '@/common/core/types/any-object';
import type { select2 } from '@/common/core/types/select2';

export class ${className} extends Mapper {
  fieldMappingKeys = {
    // MAPPINGS_HERE
  };

  // PROPS_HERE ("Required" removed from template)

  constructor(json?: AnyObject) {
    super();
    this.map(json);
  }
}
`;
        if (customHeader) {
            content = customHeader + '\n' + content;
        }
        
        fs.writeFileSync(filePath, content);
        console.log(`✅ [Model] Created new model: ${className} ${(customHeader ? '(with custom header)' : '')}`);
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
    
    // 0. Tentativa via LOG (Prioritária e Estrita)
    if (generatedFiles.length > 0) {
        const normalizedTab = kebabCase(normalizeText(tab.name));
        console.log(`🔍 [UI] Procurando em LOG para aba: ${tab.name} (${normalizedTab})`);
        
        if (tab.name === 'Principal' || tab.name === 'Conta') {
             const candidates = generatedFiles.filter(f => f.includes('/pages/') && f.includes('/form/') && (
                 f.endsWith('/form/index.tsx') || f.endsWith('/tabs/index.tsx')
             ));
             const moduleLower = MODULE.toLowerCase();
             const validCandidates = candidates.filter(f => f.includes(`/${moduleLower}/`));
             
             if (validCandidates.length > 0) {
                 uiFilePath = validCandidates.find(f => f.endsWith('/tabs/index.tsx')) || validCandidates[0];
             }
        } else {
             const tabKebab = kebabCase(normalizeText(tab.name));
             const tabSimple = tabKebab.replace(/-/g, '');
             const tabClean = tabKebab.replace(/-de-|-do-|-da-/g, '-');
             
             // Busca genérica para UI também
             let candidates = generatedFiles.filter(f => 
                f.includes('/pages/') && 
                f.includes('/form/tabs/') && 
                (f.toLowerCase().includes(`/${tabKebab}/`) || f.toLowerCase().includes(`/${tabSimple}/`) || f.toLowerCase().includes(`/${tabClean}/`))
             );
             
             if (candidates.length === 0) {
                  // Fallback: search by keywords
                  const words = tabKebab.split('-').filter(w => w.length > 2 && !['de','do','da'].includes(w));
                  candidates = generatedFiles.filter(f => 
                    f.includes('/pages/') && 
                    f.includes('/form/tabs/') && 
                    words.every(w => f.toLowerCase().includes(w))
                 );
             }

             if (candidates.length > 0) {
                  uiFilePath = candidates[0];
             }
        }
    }

    if (!uiFilePath || !fs.existsSync(uiFilePath)) {
        console.warn(`⚠️ [UI] Arquivo UI não encontrado no LOG para aba ${tab.name}. Pulando fix.`);
        return false; 
    }
    
    console.log(`✅ [UI] Corrigindo arquivo identificado no log: ${path.basename(uiFilePath)}`);

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
            // Substituir Forms.Simple por Forms.Header se necessário (mais robusto)
            if (content.includes('Forms.Simple')) {
                content = content.replace(/<Forms\.Simple/g, '<Forms.Header');
                content = content.replace(/<\/Forms\.Simple>/g, '</Forms.Header>');
                modified = true;
            }
            
            let injectHtml = '';
            fieldsToInject.forEach(f => {
                let component = f.type === 'select' || f.key.endsWith('Id') ? 'Select2' : 'Input';
                if (f.type === 'checkbox' || f.type === 'boolean') component = 'Checkbox';
                if (f.type === 'date') component = 'Date';
                
                let props = `label={t('${camelCase(f.label)}')}`;
                
                if (component === 'Select2') {
                    // Placeholder para Select2 dataApi conforme o Guia
                    injectHtml += `\n        <Form.${component} 
          label={t('${camelCase(f.label)}')}
          dataApi={{ 
            model: ANY_MODEL_HERE, 
            controller: M8Controllers.ANY, 
            loadSelect2Route: 'ANY_ROUTE_SELECAO' 
          }} 
          {...register("${f.key}")} 
        />`;
                } else if (component === 'Checkbox') {
                    injectHtml += `\n        <Form.Checkbox label={t('${camelCase(f.label)}')} {...register("${f.key}")} />`;
                } else {
                    injectHtml += `\n        <Form.${component} label={t('${camelCase(f.label)}')} {...register("${f.key}")} />`;
                }
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
    
    // Check for Grid Injection
    if (tab.hasGrid && !content.includes('<DataGrids') && !content.includes('<Grid')) {
        console.log(`🔧 [UI] Injecting Grid into ${path.basename(uiFilePath)}`);
        if (content.includes('Forms.Header') || content.includes('Forms.Main')) {
             // Inject Grid columns based on fields? Or just generic?
             const gridColumns = tab.fields.slice(0, 5).map(f => `{ field: '${camelCase(f.key)}', title: t('${camelCase(f.label)}') }`).join(',\n        ');
             
             const newReturn = `    <DataGrids.Main
      tabName="${tab.name.toLowerCase()}"
      modelName="${tabNamePascal}" 
      columns={[
        ${gridColumns}
      ]}
    />`;
             
             // Replace Return block
             // Regex to find return (...);
             const returnRegex = /return\s*\(\s*<[\s\S]*?>[\s\S]*?\)\s*;/;
             
             if (returnRegex.test(content)) {
                  content = content.replace(returnRegex, `return (\n${newReturn}\n  );`);
                  
                  // Add Import
                  // Fix check to look for import statement
                  if (!content.includes('import { DataGrids')) {
                      content = `import { DataGrids } from '@/common/components/datagrids';\n` + content;
                  }
                  
                  fs.writeFileSync(uiFilePath, content);
                  return true;
             }
        }
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

    // --- NOVA ETAPA: Corrigir referências de "model: ," nos arquivos gerados ---
    fixBrokenReferences(tab, tabNamePascal);
});

// --- NOVA ETAPA: Corrigir Grid de Listagem ---
fixGrid();

function fixGrid() {
    if (listColumns.length === 0) return;
    
    console.log('--- Fixing Grid Columns ---');
    
    let gridFilePath = null;
    const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
    
    if (generatedFiles.length > 0) {
        gridFilePath = generatedFiles.find(f => f.includes('/grids/') && f.includes(screenKebab) && f.endsWith('.tsx'));
    }

    if (!gridFilePath || !fs.existsSync(gridFilePath)) {
        const gridDir = path.join(FRONT_SRC, 'common', 'core', 'grids', MODULE.toLowerCase());
        if (fs.existsSync(gridDir)) {
            const files = fs.readdirSync(gridDir);
            const found = files.find(f => f.includes(screenKebab) && f.endsWith('.tsx'));
            if (found) gridFilePath = path.join(gridDir, found);
        }
    }

    if (gridFilePath && fs.existsSync(gridFilePath)) {
        console.log(`🔧 [Grid] Corrigindo colunas em: ${path.basename(gridFilePath)}`);
        let content = fs.readFileSync(gridFilePath, 'utf-8');
        let modified = false;

        // Tenta achar o model associado à Grid para traduzir colunas
        const modelMatch = content.match(/modelName=['"](\w+)['"]/) || 
                           content.match(/gridName=['"](\w+)['"]/) ||
                           content.match(/GridComponentProps<(\w+)>/);
                           
        let mappings = {};
        if (modelMatch) {
            const modelName = modelMatch[1];
            // Busca o arquivo do model
            const modelKebab = kebabCase(modelName);
            let modelContent = null;
            
            // 1. Tenta via nomes conhecidos
            const p1 = path.join(modelsDir, `${modelKebab}.ts`);
            const p2 = path.join(commonModelsDir, `${modelKebab}.ts`);
            if (fs.existsSync(p1)) modelContent = fs.readFileSync(p1, 'utf-8');
            else if (fs.existsSync(p2)) modelContent = fs.readFileSync(p2, 'utf-8');
            
            // 2. Tenta via Log
            if (!modelContent && generatedFiles.length > 0) {
                const candidate = generatedFiles.find(f => f.includes('/models/') && f.includes(modelKebab));
                if (candidate && fs.existsSync(candidate)) modelContent = fs.readFileSync(candidate, 'utf-8');
            }

            // 3. Procura também via import no arquivo
            if (!modelContent) {
                const importMatch = content.match(new RegExp(`import\\s+{[\\s\\S]*?${modelName}[\\s\\S]*?}\\s+from\\s+['"](.+?)['"]`));
                if (importMatch) {
                    const importPath = importMatch[1];
                    const relPath = importPath.replace('@/', '').replace(/\//g, path.sep) + '.ts';
                    const fullPath = path.join(FRONT_SRC, relPath).replace('common' + path.sep + 'common', 'common');
                    if (fs.existsSync(fullPath)) modelContent = fs.readFileSync(fullPath, 'utf-8');
                }
            }

            if (modelContent) {
                mappings = extractFieldMappingsFromModel(modelContent);
            }
        }

        const columnsToInject = [];
        listColumns.forEach(col => {
            let reactField = mappings[col.field] || col.field;
            
            // Normalizar campos padrão
            if (reactField.toLowerCase() === 'id') reactField = 'id';
            if (reactField.toLowerCase() === 'ativo') reactField = 'ativo';

            // Busca por campo exato ou mapeado para evitar duplicatas
            // Ex: Se já tem 'especie.name', não coloca 'EspecieNome'
            const fieldInverted = Object.keys(mappings).find(key => mappings[key] === reactField);
            
            const fieldRegex = new RegExp(`field:\\s*['"]${reactField}['"]`, 'i');
            const fieldRegexAlt = fieldInverted ? new RegExp(`field:\\s*['"]${fieldInverted}['"]`, 'i') : null;
            
            if (!fieldRegex.test(content) && (!fieldRegexAlt || !fieldRegexAlt.test(content))) {
                columnsToInject.push({ ...col, reactField });
            }
        });

        if (columnsToInject.length > 0) {
            // Localiza o bloco columns={[ ... ]}
            const columnsStart = content.indexOf('columns={[');
            const columnsEnd = content.indexOf(']}', columnsStart);

            if (columnsStart !== -1 && columnsEnd !== -1) {
                let existingContent = content.slice(columnsStart, columnsEnd);
                let columnsHtml = '';
                
                // Garantir vírgula no último elemento existente se não houver
                const lastElementClean = existingContent.trim();
                if (lastElementClean.length > 10 && !lastElementClean.endsWith(',')) {
                    columnsHtml = ',';
                }

                columnsToInject.forEach((col, idx) => {
                    let type = 'string';
                    let fLower = col.field.toLowerCase();
                    if (fLower.includes('valor') || fLower.includes('preco')) type = 'decimal';
                    if (fLower.includes('data')) type = 'date';
                    if (fLower === 'id' || col.reactField === 'id') type = 'number';
                    if (fLower === 'ativo' || col.reactField === 'ativo') type = 'boolean';

                    // Chave de tradução limpa
                    const labelKey = camelCase(col.title).replace(/Id$/, '');

                    columnsHtml += `\n{ label: t('${labelKey}'), field: '${col.reactField}', type: '${type}', width: 150 }`;
                    if (idx < columnsToInject.length - 1) columnsHtml += ',';
                });

                content = content.slice(0, columnsEnd) + columnsHtml + content.slice(columnsEnd);
                modified = true;
                console.log(`✅ [Grid] Injetadas ${columnsToInject.length} colunas.`);
            }
        }

        if (modified) {
            fs.writeFileSync(gridFilePath, content);
        }
    }
}

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

// --- FUNÇÕES DE CORREÇÃO DE REFERÊNCIAS ---

function findBestModel(tab, tabNamePascal) {
    // Tenta encontrar o modelo usando a mesma estratégia de nomes
    const screenPascal = pascalCase(SCREEN);
    const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
    
    let possibilities = [];
    if (tab.name === 'Principal' || tab.name === 'Conta') {
        possibilities = [
            `${screenKebab}.ts`,
            `${screenPascal.slice(0, -1)}Modelo.ts`,
            `${screenPascal}Modelo.ts`
        ];
    } else {
         const cleanScreen = screenPascal.slice(0, -1);
         const tabKebab = kebabCase(normalizeText(tab.name));
         const tabKebabSingular = tabKebab.replace(/s$/, '');
         possibilities = [
            `${screenKebab}-${tabKebabSingular}.ts`,
            `${screenKebab}-${tabKebab}.ts`,
            `${tabKebabSingular}.ts`,
            `${tabKebab}.ts`,
            `${cleanScreen}${tabNamePascal}Modelo.ts`,
            `${tabNamePascal}Modelo.ts`
        ];
    }

    for (const name of possibilities) {
        const p1 = path.join(modelsDir, name);
        const p2 = path.join(commonModelsDir, name);
        if (fs.existsSync(p1)) return p1;
        if (fs.existsSync(p2)) return p2;
    }
    
    // --- FALLBACK: Se não encontrou, criar um genérico para não quebrar o build ---
    console.warn(`⚠️ [FixRef] Modelo não encontrado para aba "${tab.name}". Criando fallback...`);
    
    // Tenta listar o que tem lá para debug
    if (fs.existsSync(modelsDir)) {
         console.log(`📂 Arquivos em ${modelsDir}:`, fs.readdirSync(modelsDir).join(', '));
    }

    const sKebab = kebabCase(SCREEN).replace(/s$/, '');
    const tKebab = kebabCase(normalizeText(tab.name));
    const fallbackName = `${sKebab}-${tKebab}.ts`;
    const fallbackPath = path.join(modelsDir, fallbackName);
    const className = pascalCase(fallbackName.replace('.ts', ''));
    
    // Adicionar comentário específico se for criado via fallback
    const comment = `/**
 * ESTE MODELO NÃO FOI GERADO POR SCAFFOLDING
 * Criado automaticamente como fallback para a aba: ${tab.name}
 */`;

    ensureModelExists(fallbackPath, className, comment);
    
    return fallbackPath;
}

function fixBrokenReferences(tab, tabNamePascal) {
    const modelPath = findBestModel(tab, tabNamePascal);
    if (!modelPath) return;

    // Descobrir nome da classe
    const modelContent = fs.readFileSync(modelPath, 'utf-8');
    const classMatch = modelContent.match(/export class (\w+)/);
    const modelClassName = classMatch ? classMatch[1] : null;

    if (!modelClassName) return;

    // Arquivos para verificar: UI e Services
    const filesToCheck = [];

    // 1. UI File
    const uiPaths = getExpectedUIPaths(tab.name);
    
    // Page Dirs to check (same logic as services)
    const pageDirsToCheck = [];
    pageDirsToCheck.push(pageDirName); // Derived from tab name
    if (config.keywordUrl) {
         const kw = config.keywordUrl;
         pageDirsToCheck.push(kw.toLowerCase()); 
         pageDirsToCheck.push(kw.toLowerCase().replace(/s$/, ''));
         pageDirsToCheck.push(kebabCase(kw));
         pageDirsToCheck.push(kebabCase(kw).replace(/s$/, ''));
    }
    
    const uniquePageDirs = [...new Set(pageDirsToCheck)];
    
    uniquePageDirs.forEach(pDir => {
         uiPaths.forEach(pRelative => {
             const p = path.join(pagesBase, pDir, 'form', pRelative);
             // pagesBase already has @Module/pages/
             // wait, pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
             // so path is pagesBase + pDir + form + pRelative?
             // NO. pagesBase is C:/.../pages. 
             // pageDirName was just a name. 
             // But verify line 122: const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
             
             // BUT, the original code used: path.join(pagesBase, pageDirName, 'form', pRelative);
             // So I should replace pageDirName with pDir.
             
             // EXCEPT, pagesBase + pDir might be wrong if pagesBase is just /pages.
             // Line 122: const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
             // Correct.
             
             const fullPath = path.join(pagesBase, pDir, 'form', pRelative);
             if (fs.existsSync(fullPath)) filesToCheck.push(fullPath);
         });
    });

    // 2. Service Files
    // Services ficam em src/@Modulo/services/PAGE-NAME/
    // PAGE-NAME pode ser derivado da aba ou do keywordUrl
    const serviceDirsToCheck = [];
    
    // 1. Baseado na aba (kebab-case)
    serviceDirsToCheck.push(path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', pageDirName));
    
    // 2. Baseado no keywordUrl (ex: LancamentoEntradaCaixas -> lancamentoentradacaixa ou lancamento-entrada-caixa)
    if (config.keywordUrl) {
         const kw = config.keywordUrl;
         serviceDirsToCheck.push(path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', kw.toLowerCase())); // lancamentoentradacaixas
         serviceDirsToCheck.push(path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', kw.toLowerCase().replace(/s$/, ''))); // lancamentoentradacaixa
         serviceDirsToCheck.push(path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', kebabCase(kw))); // lancamento-entrada-caixas
         serviceDirsToCheck.push(path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', kebabCase(kw).replace(/s$/, ''))); // lancamento-entrada-caixa
    }

    const uniqueServiceDirs = [...new Set(serviceDirsToCheck)].filter(d => fs.existsSync(d));

    console.log(`🔍 [FixRef] Procurando serviços em: ${uniqueServiceDirs.map(d => path.basename(d)).join(', ')}`);

    uniqueServiceDirs.forEach(serviceDir => {
        const serviceFiles = fs.readdirSync(serviceDir);
        // Filtrar services que podem ser dessa aba
        const tabKebab = kebabCase(normalizeText(tab.name));
        serviceFiles.forEach(f => {
             // Aceita qualquer arquivo service que pareça relevante
            if (f.includes(tabKebab) || (tab.name === 'Principal' && f.includes(path.basename(serviceDir)))) {
                filesToCheck.push(path.join(serviceDir, f));
            }
        });
    });

    filesToCheck.forEach(filePath => {
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        // Regex para model: , ou model:,
        if (/model:\s*[^,]+,/.test(content)) {
            console.log(`🔧 [FixRef] Corrigindo referência de modelo em: ${path.basename(filePath)}`);
            
            // 2. Corrigir tipagem de Service e chamada de makeService/useForm
            if (filePath.endsWith('Service.ts')) {
                // Tipar BaseService<Model>
                content = content.replace(/extends BaseService<[^>]*>/g, `extends BaseService<${modelClassName}>`);
                content = content.replace(/extends BaseService\s*{/g, `extends BaseService<${modelClassName}> {`);
                
                // makeService(Class, { model: Class, ... })
                content = content.replace(/model:\s*new\s+\w+\(\),/g, `model: ${modelClassName},`);
                content = content.replace(/model:\s*,/g, `model: ${modelClassName},`);
            } else if (filePath.endsWith('.tsx')) {
                // useForm({ model: Class, ... })
                content = content.replace(/model:\s*new\s+\w+\(\),/g, `model: ${modelClassName},`);
                content = content.replace(/model:\s*([^,]+),/g, (match, p1) => {
                    if (p1.trim() === '' || p1.includes('new ')) return `model: ${modelClassName},`;
                    return match;
                });
            }
            
            modified = true;
        }

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ [FixRef] Salvo: ${path.basename(filePath)}`);
        }
    });
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
console.log(`🔧 Referências corrigidas automaticamente no passo extra.`);

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

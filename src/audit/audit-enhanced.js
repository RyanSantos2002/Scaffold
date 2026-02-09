const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Configuração Básica
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = path.join(__dirname, '..', 'capture');
const CONFIG_PATH = path.join(__dirname, '..', '..', 'capture', '@Config', 'index.js');
const OUTPUT_DIR = path.join(__dirname, '..', 'auditoria_outputs');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Utilitários de String
const camelCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '');
const pascalCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '');
const kebabCase = (str) => str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');
const normalizeText = (text) => text ? text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").trim() : "";

// Carregar Configuração
if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Configuração não encontrada em: ${CONFIG_PATH}`);
    process.exit(1);
}
const config = require(CONFIG_PATH);
const MODULE = config.modulo;
const SCREEN = config.tela;

// Load Generated Files Log
const GENERATED_LOG = path.join(__dirname, '..', '..', '..', 'Projeto-Scaffolding', 'generated-files.json');
let generatedFiles = [];
if (fs.existsSync(GENERATED_LOG)) {
    try {
        generatedFiles = JSON.parse(fs.readFileSync(GENERATED_LOG, 'utf-8')).map(f => f.replace(/\\/g, '/'));
        // Normalize paths to lowercase for easier comparison
        generatedFiles = generatedFiles.map(p => p.toLowerCase().replace(/\/+/g, '/'));
        console.log(`✅ Log de Arquivos Gerados carregado: ${generatedFiles.length} arquivos.`);
    } catch (e) {
        console.warn("Erro ao carregar log de arquivos:", e.message);
    }
} else {
    console.error('❌ ERRO CRÍTICO: Log de Arquivos Gerados não encontrado em:', GENERATED_LOG);
    console.error('Certifique-se de que o scaffolding rodou e gerou o arquivo.');
    process.exit(1);
}

// 1. Localizar HTML Fonte
// Novo caminho: output/Form (onde engine.js salva)
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

// 2. Extração Profunda de Dados do HTML
function extractDeepMetadata() {
    const tabsData = [];
    const fieldsData = []; // Flat list for model checking

    // Tenta encontrar as abas
    let tabList = $('ul#frmContaTab, ul.nav-tabs, ul.tabbable').first();
    const tabsFound = [];

    if (tabList.length) {
        tabList.find('li').each((i, el) => {
            const link = $(el).find('a').first();
            const rawName = link.text().trim();
            const name = rawName.split(':')[0].trim(); // Remove counters like "Contatos: 5"
            const href = link.attr('href');
            const tabId = href ? href.replace('#', '') : null;
            const onClick = $(el).attr('onclick') || link.attr('onclick') || "";

            tabsFound.push({ index: i, name, id: tabId, onClick, rawName });
        });
    } else {
        // Se não achar abas explícitas, considera o formulário inteiro como uma aba "Principal"
        tabsFound.push({ index: 0, name: 'Principal', id: 'main-content', onClick: '', rawName: 'Principal' });
    }

    // Para cada aba, extrair campos e grids
    tabsFound.forEach(tab => {
        const tabInfo = {
            name: tab.name,
            fields: [],
            hasGrid: false,
            gridColumns: [],
            dependencies: [],
            missingFieldsInModel: [],
            missingFieldsInUI: []
        };

        // Verifica Grid no onClick
        if (tab.onClick && (tab.onClick.includes('AcaoGrid') || tab.onClick.includes('tbl'))) {
            tabInfo.hasGrid = true;
            // Tenta extrair colunas da grid (heurística baseada em scripts no HTML se possível, mas difícil sem executar JS)
            // Vamos marcar que TEM grid e vamos procurar se o arquivo gerado tem grid.
        }

        // Se tem ID, busca container. Se não, busca no corpo (ex: Principal)
        let container = tab.id && tab.id !== 'main-content' ? $(`#${tab.id}`) : $('body');
        
        // Se container não achado pelo ID, tenta achar div com classe tab-pane active ou similar
        if (tab.id && container.length === 0) {
             container = $(`.tab-pane#${tab.id}`);
        }

        if (container.length) {
            // Extrair Campos
            container.find('input, select, textarea').each((j, inp) => {
                const input = $(inp);
                const name = input.attr('name');
                const type = input.attr('type') || input.prop('tagName').toLowerCase();

                if (!name || type === 'hidden' || name === 'undefined') return;

                const label = input.closest('.form-group').find('label').first().text().trim() || name;
                const required = input.attr('required') || input.attr('data-obrigatorio') === 'true';
                const maxLength = input.attr('maxlength');
                
                // Checar dependências (ex: data-dependency-to) - Padrão hipotético ou comum
                const dependency = input.attr('data-dependency') || input.attr('data-show-if');
                if (dependency) {
                    tabInfo.dependencies.push(`Campo **${name}** depende de: \`${dependency}\``);
                }

                 // Verifica se está dentro de um bloco oculto (ex: style="display:none")
                 let isHidden = false;
                 if (input.closest('[style*="display:none"]').length > 0) {
                     isHidden = true;
                     tabInfo.dependencies.push(`Campo **${name}** está em um bloco oculto inicialmente.`);
                 }

                const fieldObj = {
                    key: name,
                    label: label,
                    type: type,
                    required: !!required,
                    maxLength: maxLength,
                    isHidden
                };

                tabInfo.fields.push(fieldObj);
                fieldsData.push({ ...fieldObj, tabName: tab.name });
            });
        }
        
        tabsData.push(tabInfo);
    });

    return { tabsData, fieldsData };
}

function extractFieldMappingsFromModel(modelContent) {
    const mappings = {};
    if (!modelContent) return mappings;

    // Busca o bloco fieldMappingKeys
    const mappingBlockMatch = modelContent.match(/fieldMappingKeys\s*=\s*\{([\s\S]*?)\s*\}/);
    if (mappingBlockMatch && mappingBlockMatch[1]) {
        const rawBody = mappingBlockMatch[1];
        // Regex robusta para 'field': 'Mapping'
        const regex = /['"]?([\w.[\]-]+)['"]?\s*:\s*['"](.+?)['"]/g;
        let m;
        while ((m = regex.exec(rawBody)) !== null) {
            mappings[m[2].trim()] = m[1].trim(); 
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
            // Limpeza básica para lidar com templates e funções JS no JSON
            const cleanJson = scriptContent[1]
                .replace(/template:"[\s\S]*?"/g, 'template:""')
                .replace(/footerTemplate:"[\s\S]*?"/g, 'footerTemplate:""')
                .replace(/function[\s\S]*?\{[\s\S]*?\}/g, 'null');
            
            // Tenta um parse manual simplificado ou regex se o JSON for muito sujo
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
        } catch (e) {
            console.warn("Erro ao parsear colunas via script:", e.message);
        }
    }

    // Tenta 2: Extrair do thead se falhar script
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

const { tabsData, fieldsData } = extractDeepMetadata();
const listColumns = extractGridColumnsFromListHTML(listHtmlContent);

// 3. Preparar Relatório
const report = [];
report.push(`# Relatório de Auditoria Detalhada: ${SCREEN}`);
report.push(`**Data:** ${new Date().toLocaleString()}`);
report.push(`**Fonte:** HTML Capturado`);

// 4. Auditoria de Models (Backend/Frontend Shared)
// Vamos checar se TODOS os campos encontrados no HTML existem no Model principal ou nos sub-models
// Como o scaffold gera models separados por aba (ex: ContaEnderecoModelo), vamos tentar ser inteligentes.

console.log('Auditando Models...');
const modelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', MODULE.toLowerCase());

function checkFieldInModel(field, modelContent) {
    const key = camelCase(field.key);
    // Regex flexível para achar propriedade na classe
    const regex = new RegExp(`${key}\\??\\s*:`, 'i');
    return regex.test(modelContent);
}

// Mapear Models existentes no diretório
const existingModels = new Map();
if (fs.existsSync(modelsDir)) {
    fs.readdirSync(modelsDir).forEach(f => {
        if (f.endsWith('.ts')) {
            existingModels.set(f, fs.readFileSync(path.join(modelsDir, f), 'utf-8'));
        }
    });
}

report.push(`\n## 1. Verificação de Modelos`);

tabsData.forEach((tab, index) => {
    report.push(`\n### Aba: ${tab.name}`);
    
    // Tenta achar o model dessa aba
    // Convenção ATUALIZADA:
    // 1. Kebab-case sem sufixo: conta.ts, conta-contato.ts (PADRÃO REAL DO PROJETO)
    // 2. PascalCase com Modelo: ContasModelo.ts, ContaEnderecoModelo.ts (compatibilidade)
    
    let targetModelContent = null;
    let targetModelName = "Desconhecido";
    const triedNames = []; // Para debug

    if (index === 0) {
         // --- ABA PRINCIPAL (Busca no LOG) ---
         // Procura algo que tenha o nome da tela no modulo models
         const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
         
         // 1. Tenta achar o arquivo specífico no log
         // Ex: lancamento-entrada-caixa.ts
         let bestMatch = generatedFiles.find(f => 
            f.includes('/models/') && 
            (f.endsWith(`/${screenKebab}.ts`) || f.includes(screenKebab))
         );
         
         if (bestMatch && fs.existsSync(bestMatch)) {
             try {
                targetModelContent = fs.readFileSync(bestMatch, 'utf-8');
                targetModelName = path.basename(bestMatch) + " (Via Log)";
             } catch (e) {}
         }
    } else {
        // --- ABAS SECUNDÁRIAS (Busca no LOG) ---
        const tabKebab = kebabCase(normalizeText(tab.name));
        const tabKebabSingular = tabKebab.replace(/s$/, ''); // anexos -> anexo
        const tabSimple = tabKebab.replace(/-de-|-do-|-da-|-dos-|-das-/g, '-'); // centro-de-custo -> centro-custo

        const screenKebab = kebabCase(SCREEN).replace(/s$/, '');

        // 1. Busca Estrita: Screen + Tab
        let candidates = generatedFiles.filter(f => 
            f.includes('/models/') && 
            f.includes(screenKebab) && 
            (f.includes(tabKebabSingular) || f.includes(tabKebab))
        );

        // 2. Busca Relaxada: Apenas Tab (dentro dos arquivos gerados para esta tela)
        if (candidates.length === 0) {
            candidates = generatedFiles.filter(f => 
                f.includes('/models/') && 
                (f.includes(tabKebabSingular) || f.includes(tabSimple) || f.includes(tabKebab.replace(/-/g, '')))
            );
        }

        // 3. Busca por palavras chave soltas (ex: "centro" e "custo")
        if (candidates.length === 0) {
             const words = tabKebab.split('-').filter(w => w.length > 2 && !['de','do','da'].includes(w));
             candidates = generatedFiles.filter(f => 
                f.includes('/models/') && 
                words.every(w => f.includes(w))
             );
        }

        if (candidates.length > 0) {
            // Pega o primeiro candidato válido (Log ordena por criação ou ordem de insert, geralmente ok)
            const best = candidates[0];
            if (fs.existsSync(best)) {
                targetModelContent = fs.readFileSync(best, 'utf-8');
                targetModelName = path.basename(best) + " (Via Log)";
            }
        }
    }

    if (!targetModelContent) {
        if (tab.fields.length > 0) {
            report.push(`❌ **Modelo Principal não encontrado para esta aba.** (Campos esperados: ${tab.fields.length})`);
            report.push(`> *Nomes tentados: ${triedNames.join(', ')}*`);
        } else {
            report.push(`ℹ️ Aba sem campos de formulário (possivelmente apenas Grid ou vazia).`);
        }
    } else {
        report.push(`✅ **Modelo Analisado:** \`${targetModelName}\``);
        
        // Validação de Qualidade do Modelo
        const lines = targetModelContent.split('\n');
        // Filtra linhas que parecem propriedades (tem ponto e vírgula, não são imports/metodos)
        const propertyLines = lines.filter(l => l.trim().includes(';') && !l.includes('import') && !l.includes('fieldMappingKeys') && !l.includes('constructor') && !l.includes('super') && !l.includes('map(') && !l.trim().startsWith('//'));
        const radioFields = propertyLines.filter(l => l.toLowerCase().includes('optradio'));

        if (propertyLines.length === 0) {
             report.push(`❌ **ERRO CRÍTICO: Modelo vazio!** A classe parece não ter propriedades.`);
        }
        if (radioFields.length > 2) {
             report.push(`❌ **ERRO CRÍTICO: Modelo Lixo detectado.** Encontrados ${radioFields.length} campos 'optradio', indicando geração incorreta a partir de HTML sujo.`);
        }
        const missing = [];
        const ruleIssues = [];

        tab.fields.forEach(f => {
            if (!checkFieldInModel(f, targetModelContent)) {
                missing.push(f.key);
            } else {
                // Checar regras (Required, MaxLength) - Simples check de string
                const key = camelCase(f.key);
                // Pegar bloco em volta do campo
                const lines = targetModelContent.split('\n');
                const lineIdx = lines.findIndex(l => new RegExp(`${key}\\??\\s*:`, 'i').test(l));
                
                if (lineIdx !== -1) {
                    const block = lines.slice(Math.max(0, lineIdx - 5), lineIdx).join('\n');
                    
                    if (f.required && !block.includes('@Required')) {
                        ruleIssues.push(`⚠️ Campo **${f.label}** (${f.key}) é Obrigatório no HTML, mas falta @Required no Model.`);
                    }
                    if (f.maxLength && !block.includes(`@MaxLength(${f.maxLength})`)) {
                        ruleIssues.push(`⚠️ Campo **${f.label}** (${f.key}) tem MaxLength(${f.maxLength}), não verificado no Model.`);
                    }
                }
            }
        });

        if (missing.length > 0) {
            report.push(`\n**❌ Campos Faltantes no Modelo:**`);
            missing.forEach(m => report.push(`- [ ] \`${m}\``));
        } else {
            report.push(`- ✅ Todos os ${tab.fields.length} campos presentes no modelo.`);
        }

        // Validação de Herança e Imports
        if (!targetModelContent.includes('extends Mapper')) {
            report.push(`❌ **ERRO: Herança incorreta.** O modelo não estende \`Mapper\`.`);
        }
        if (targetModelContent.includes('@Required') && !targetModelContent.includes('@/common/helpers/class-validator/required')) {
            report.push(`❌ **ERRO: Import de @Required incorreto.** Deve ser \`@/common/helpers/class-validator/required\`.`);
        }
        if (targetModelContent.includes('@MaxLength') && !targetModelContent.includes('@/common/helpers/class-validator/max-length')) {
            report.push(`❌ **ERRO: Import de @MaxLength incorreto.** Deve ser \`@/common/helpers/class-validator/max-length\`.`);
        }

        if (ruleIssues.length > 0) {
           report.push(`\n**⚠️ Discrepâncias de Regras:**`);
           ruleIssues.forEach(r => report.push(`- ${r}`));
        }
    }
});


// Caminho das Pages - baseado na primeira aba
const firstTabNormalized = kebabCase(normalizeText(tabsData[0]?.name || 'principal'));
let pageDirName = firstTabNormalized; // Nome dinâmico baseado na primeira aba
const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
const tabsDir = path.join(pagesBase, pageDirName, 'form', 'tabs');

console.log(`Auditando Pages em: ${pagesBase}`);
console.log(`Procurando tabs em: ${tabsDir}`);

tabsData.forEach(tab => {
    report.push(`\n### Aba: ${tab.name}`);
    
    // Tenta achar o arquivo da aba
    let tabFile = null;
    let tabFilePath = '';
    const normalizedTab = kebabCase(normalizeText(tab.name));
    const moduleLower = MODULE.toLowerCase();

    // 0. Tentativa via LOG (Alta precisão)
    if (generatedFiles.length > 0) {
        let candidates = [];
        if (tab.name === 'Principal' || tab.name === 'Conta') {
             // Abas principais podem ser index.tsx
             candidates = generatedFiles.filter(f => 
                 f.includes(`/${moduleLower}/pages/`) && 
                 f.includes('/form/') && 
                 (f.endsWith('/form/index.tsx') || f.endsWith('/tabs/index.tsx'))
             );
        } else {
             // Abas secundárias
             candidates = generatedFiles.filter(f => 
                 f.includes(`/${moduleLower}/pages/`) && 
                 f.includes('/tabs/') && 
                 f.includes(`/${normalizedTab}/`) && 
                 f.endsWith('.tsx')
             );
        }

        if (candidates.length > 0) {
             const best = candidates.find(f => f.includes('/tabs/')) || candidates[0];
             if (fs.existsSync(best)) {
                 tabFilePath = best;
                 tabFile = fs.readFileSync(tabFilePath, 'utf-8');
             }
        }
    }

    // 1. Fallback via nomes previsiveis
    if (!tabFile) {
        const possibilities = [
            path.join(normalizedTab, 'index.tsx'),
            `${normalizedTab}.tsx`,
            'index.tsx'
        ];
        
        // Tenta em dois diretórios possíveis (visto discrepancia entrada-caixa vs lancamentoentradacaixa)
        const possibleDirs = [
            tabsDir,
            path.join(pagesBase, 'lancamentoentradacaixa', 'form', 'tabs'),
            path.join(pagesBase, kebabCase(SCREEN), 'form', 'tabs')
        ];

        for (const d of possibleDirs) {
            if (!fs.existsSync(d)) continue;
            for (const p of possibilities) {
                const tryPath = path.join(d, p);
                if (fs.existsSync(tryPath)) {
                    tabFile = fs.readFileSync(tryPath, 'utf-8');
                    tabFilePath = tryPath;
                    break;
                }
            }
            if (tabFile) break;
        }
    }

    if (!tabFile) {
        report.push(`❌ **Arquivo da Aba NÃO encontrado** em \`${tabsDir}\``);
        if (tab.fields.length > 0) {
            report.push(`  - ❗ ${tab.fields.length} campos não estão mapeados na UI.`);
        }
    } else {
        report.push(`✅ **Arquivo:** \`${path.relative(FRONT_SRC, tabFilePath)}\``);
        
        // 1. Verificar Forms.Header e TabName
        if (!tabFile.includes('Forms.Header')) {
            report.push(`❌ **ERRO: Aba não utiliza \`Forms.Header\`.**`);
        } else if (!tabFile.includes('tabName=')) {
            report.push(`❌ **ERRO: Propriedade \`tabName\` ausente no \`Forms.Header\`.**`);
        } else {
            report.push(`✅ Aba utiliza \`Forms.Header\` corretamente.`);
        }

        // 2. Verificar Campos (Register)
        const missingUI = [];
        tab.fields.forEach(f => {
             let key = camelCase(f.key);
             let keyLower = key.toLowerCase();
             let keyNoHyphenLower = key.replace(/-/g, '').toLowerCase();
             
             // Regra para remover Id do key se for um objeto relacionado (ex: GrupoEconomicoId -> grupoEconomico)
             let keyWithoutId = key.endsWith('Id') ? key.slice(0, -2) : null;
             let keyWithoutIdLower = keyWithoutId ? keyWithoutId.toLowerCase() : null;
             let keyWithoutIdNoHyphenLower = keyWithoutId ? keyWithoutId.replace(/-/g, '').toLowerCase() : null;

             const tabFileLower = tabFile.toLowerCase();
             
             const hasRegister = tabFileLower.includes(`register('${keyLower}')`) || 
                                tabFileLower.includes(`register("${keyLower}")`) ||
                                tabFileLower.includes(`register('${keyNoHyphenLower}')`) || 
                                tabFileLower.includes(`register("${keyNoHyphenLower}")`);
             
             const hasRegisterNoId = keyWithoutIdLower && (
                                tabFileLower.includes(`register('${keyWithoutIdLower}')`) || 
                                tabFileLower.includes(`register("${keyWithoutIdLower}")`) ||
                                tabFileLower.includes(`register('${keyWithoutIdNoHyphenLower}')`) || 
                                tabFileLower.includes(`register("${keyWithoutIdNoHyphenLower}")`));
             
             const hasName = tabFileLower.includes(`name='${keyLower}'`) || 
                             tabFileLower.includes(`name="${keyLower}"`) ||
                             tabFileLower.includes(`name='${keyNoHyphenLower}'`) || 
                             tabFileLower.includes(`name="${keyNoHyphenLower}"`);

             if (!hasRegister && !hasName && !hasRegisterNoId) {
                missingUI.push(f.key);
             }
        });

        // Detecção de Lixo na UI
        const fieldsInFile = (tabFile.match(/name=['"]([^'"]+)['"]/g) || []).map(m => m.replace(/name=['"]|['"]/g, ''));
        const garbageFields = fieldsInFile.filter(f => f.toLowerCase().includes('optradio') || f.toLowerCase().includes('btn'));
        
        if (garbageFields.length > 0) {
            report.push(`- ⚠️ **LIXO DETECTADO NA UI:** Encontrados ${garbageFields.length} campos suspeitos (ex: ${garbageFields[0]}). Provável erro de scrape.`);
        }

        if (missingUI.length > 0) {
            report.push(`\n**❌ Campos Faltantes na Tela (TSX):**`);
            missingUI.forEach(m => report.push(`- [ ] \`${m}\` (Label: ${tab.fields.find(x => x.key === m).label})`));
        } else {
             if (tab.fields.length > 0)
                report.push(`- ✅ Todos os ${tab.fields.length} campos encontrados na UI.`);
        }

        // 3. Verificar Grids
        if (tab.hasGrid) {
            if (tabFile.includes('DataGrids') || (tabFile.includes('<Grid') && tabFile.includes('Columns'))) {
                report.push(`- ✅ Grid detectada no código.`);
            } else {
                report.push(`- ❌ **Grid esperada mas NÃO detectada no código.**`);
            }
        }

        // 4. Dependências
        if (tab.dependencies.length > 0) {
            report.push(`\n**ℹ️ Dependências e Condicionais Detectadas (HTML):**`);
            tab.dependencies.forEach(d => report.push(`- ${d}`));
            report.push(`> *Verifique se logicas como \`watch('${tab.dependencies[0]?.split('`')[1]}')\` estão implementadas.*`);
        }
    }
});


// 6. Auditoria de Serviço (Via LOG estrito)
console.log('Auditando Serviços...');
report.push(`\n## 3. Verificação de Serviços`);
let servicesDir = null;

// Busca pasta de serviço no LOG
// Padrão: .../services/[nome-da-tela]
const screenKebab = kebabCase(SCREEN).replace(/s$/, ''); // ex: caixa
const serviceCandidate = generatedFiles.find(f => 
    f.includes('/services/') && 
    (f.includes(`/${screenKebab}/`) || f.includes(screenKebab)) &&
    f.endsWith('service.ts')
);

if (serviceCandidate) {
    // Extrai diretório do arquivo encontrado
    // ex: .../services/lancamentoentradacaixa/lancamentoentradacaixa-service.ts
    // Queremos: .../services/lancamentoentradacaixa
    const fullPath = serviceCandidate; // path vindo do log já é absoluto (mas em lowercase no array, cuidado)
    
    // Precisamos achar o path original (case sensitive) ou usar o do disco
    // O array generatedFiles está todo em lowercase. Vamos tentar reconstruir ou achar no disco.
    const serviceDirLower = path.dirname(fullPath);
    
    // Tenta encontrar o diretorio real no disco que bata com esse path lower
    if (fs.existsSync(serviceDirLower)) {
        servicesDir = serviceDirLower;
    } else {
        // Tenta achar com casing correto baseado no FRONT_SRC
        // Mas como o log tem path absoluto, se o arquivo existe, o path existe.
        // O problema é que o generatedFiles[] foi convertido para lowercase.
        // Vamos tentar ler o arquivo JSON original de novo para pegar o path com Case correto se precisarmos abrir arquivos.
        // Mas para check de existência, lowercase pode funcionar em Windows, mas melhor ser seguro.
        
        // Simplesmente checa se existe o caminho construído
         if (fs.existsSync(fullPath)) {
             servicesDir = path.dirname(fullPath);
         }
    }
}

if (servicesDir && fs.existsSync(servicesDir)) {
    const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.toLowerCase().endsWith('service.ts'));
    if (serviceFiles.length > 0) {
        report.push(`✅ **Serviços Encontrados (Via Log):**`);
        serviceFiles.forEach(s => {
             const sPath = path.join(servicesDir, s);
             const sContent = fs.readFileSync(sPath, 'utf-8');
             let issues = [];
             if (sContent.includes('BaseService<>')) issues.push("BaseService genérico");
             if (sContent.includes('AssistenciaTecnica')) issues.push("Placeholder AssistenciaTecnica");
             
             if (issues.length > 0) report.push(`- ❌ \`${s}\`: ${issues.join(', ')}`);
             else {
                 // Verificação do makeService
                 if (!sContent.includes('makeService(') || !sContent.includes('controller:') || !sContent.includes('routes:')) {
                     report.push(`- ⚠️ \`${s}\`: Estrutura \`makeService\` parece incompleta.`);
                 } else {
                     report.push(`- ✅ \`${s}\``);
                 }
             }
        });
    } else {
         report.push(`❌ Nenhum arquivo *Service.ts encontrado em \`${servicesDir}\``);
    }
} else {
    report.push(`❌ Diretório de serviços não encontrado no Log de Geração.`);
}

// 7. Auditoria de Grid (Listagem)
console.log('Auditando Grid...');
report.push(`\n## 4. Verificação de Grid (Listagem)`);

if (listColumns.length === 0) {
    report.push(`⚠️ Nenhuma configuração de Grid detectada no HTML de listagem comparado.`);
} else {
    report.push(`✅ **Colunas detectadas no HTML original:** ${listColumns.length}`);
    
    // Localizar componente Grid no React
    let gridFilePath = null;
    const screenKebab = kebabCase(SCREEN).replace(/s$/, '');
    
    if (generatedFiles.length > 0) {
        const candidate = generatedFiles.find(f => f.includes('/grids/') && f.includes(screenKebab) && f.endsWith('.tsx'));
        if (candidate && fs.existsSync(candidate)) {
            gridFilePath = candidate;
        }
    }

    if (!gridFilePath) {
        // Fallback search
        const gridDir = path.join(FRONT_SRC, 'common', 'core', 'grids', MODULE.toLowerCase());
        if (fs.existsSync(gridDir)) {
            const files = fs.readdirSync(gridDir);
            const found = files.find(f => f.includes(screenKebab) && f.endsWith('.tsx'));
            if (found) gridFilePath = path.join(gridDir, found);
        }
    }

    if (gridFilePath) {
        report.push(`✅ **Componente Grid encontrado:** \`${path.relative(FRONT_SRC, gridFilePath)}\``);
        const gridContent = fs.readFileSync(gridFilePath, 'utf-8');
        
        // Tenta achar o model associado à Grid para traduzir colunas
        // Busca via modelName, gridName ou o generic do componente
        const modelMatch = gridContent.match(/modelName\s*=\s*['"](\w+)['"]/) || 
                           gridContent.match(/gridName\s*=\s*['"](\w+)['"]/) ||
                           gridContent.match(/GridComponentProps\s*<\s*(\w+)\s*>/);
        
        let mappings = {};
        if (modelMatch) {
            const modelName = modelMatch[1];
            // Procura arquivo do model
            const modelKebab = kebabCase(modelName);
            const modelFile = Array.from(existingModels.keys()).find(f => 
                f.toLowerCase() === `${modelKebab.toLowerCase()}.ts` || 
                f.toLowerCase().includes(modelKebab.toLowerCase())
            );
            
            if (modelFile) {
                mappings = extractFieldMappingsFromModel(existingModels.get(modelFile));
            } else {
                 // Busca via import no arquivo da Grid
                 const importMatch = gridContent.match(new RegExp(`import\\s+{[\\s\\S]*?${modelName}[\\s\\S]*?}\\s+from\\s+['"](.+?)['"]`));
                 if (importMatch) {
                      const importPath = importMatch[1];
                      // Transforma path @/... em path real
                      const relPath = importPath.replace('@/', '').replace(/\//g, path.sep) + '.ts';
                      const fullPath = path.join(FRONT_SRC, relPath).replace('common' + path.sep + 'common', 'common');
                      if (fs.existsSync(fullPath)) {
                          mappings = extractFieldMappingsFromModel(fs.readFileSync(fullPath, 'utf-8'));
                      }
                 }
            }
        }

        if (Object.keys(mappings).length > 0) {
            report.push(`> *Mapeamentos detectados para esta Grid: ${Object.keys(mappings).length} campos.*`);
        }

        const missingCols = [];
        listColumns.forEach(col => {
            const reactField = mappings[col.field] || col.field;
            
            // Busca simplificada e robusta
            const patterns = [
                `field: '${reactField}'`,
                `field: "${reactField}"`,
                `field:'${reactField}'`,
                `field:"${reactField}"`
            ];
            const found = patterns.some(p => gridContent.toLowerCase().includes(p.toLowerCase()));

            if (!found) {
                missingCols.push({ ...col, reactField });
            }
        });

        if (missingCols.length > 0) {
            report.push(`\n**❌ Colunas Faltantes na Grid React:**`);
            missingCols.forEach(c => {
                const mapInfo = c.reactField !== c.field ? ` (Mapeado para: \`${c.reactField}\`)` : '';
                report.push(`- [ ] \`${c.field}\`${mapInfo} - Label: ${c.title}`);
            });
        } else {
            report.push(`- ✅ Todas as colunas do HTML original estão presentes na Grid React.`);
        }
    } else {
        report.push(`❌ **Componente Grid não encontrado no projeto.**`);
    }
}

// Salvar Relatório
const reportPath = path.join(OUTPUT_DIR, `auditoria_detalhada_${SCREEN}.md`);
fs.writeFileSync(reportPath, report.join('\n'));
console.log(`\n✅ Relatório Detalhado salvo em: ${reportPath}`);

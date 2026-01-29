const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

// Configuração Básica
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = __dirname;
const CONFIG_PATH = path.join(CAPTURE_DIR, 'capture', '@Config', 'index.js');
const OUTPUT_DIR = path.join(CAPTURE_DIR, 'auditoria_outputs');

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

// 1. Localizar HTML Fonte
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

console.log(`Auditando Tela: ${SCREEN} (${MODULE}) usando HTML: ${path.basename(htmlFile)}`);
const htmlContent = fs.readFileSync(htmlFile, 'utf-8');
const $ = cheerio.load(htmlContent);

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

const { tabsData, fieldsData } = extractDeepMetadata();

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

tabsData.forEach(tab => {
    report.push(`\n### Aba: ${tab.name}`);
    
    // Tenta achar o model dessa aba
    // Convenção ATUALIZADA:
    // 1. Kebab-case sem sufixo: conta.ts, conta-contato.ts (PADRÃO REAL DO PROJETO)
    // 2. PascalCase com Modelo: ContasModelo.ts, ContaEnderecoModelo.ts (compatibilidade)
    
    let targetModelContent = null;
    let targetModelName = "Desconhecido";
    const triedNames = []; // Para debug

    if (tab.name === 'Principal' || tab.name === 'Conta') {
         // Para aba principal, tenta:
         // 1. conta.ts (kebab-case - PRIORITÁRIO)
         // 2. ContaModelo.ts, ContasModelo.ts (PascalCase)
         const screenKebab = kebabCase(SCREEN).replace(/s$/, ''); // 'conta'
         const possibleNames = [
             `${screenKebab}.ts`,                                    // conta.ts
             `${pascalCase(SCREEN).slice(0, -1)}Modelo.ts`,         // ContaModelo.ts
             `${pascalCase(SCREEN)}Modelo.ts`                       // ContasModelo.ts
         ];
         
         for (const name of possibleNames) {
             triedNames.push(name);
             if (existingModels.has(name)) {
                 targetModelContent = existingModels.get(name);
                 targetModelName = name;
                 break;
             }
         }
    } else {
        // Para abas secundárias, tenta:
        // 1. conta-{tab-kebab}.ts (ex: conta-contato.ts, conta-anexo.ts)
        // 2. {tab-kebab}.ts (ex: contato.ts)
        // 3. ContaEnderecoModelo.ts, etc (PascalCase - compatibilidade)
        const cleanTabName = pascalCase(normalizeText(tab.name));
        const cleanScreenName = pascalCase(SCREEN).slice(0, -1); // Conta
        const screenKebab = kebabCase(SCREEN).replace(/s$/, ''); // conta
        const tabKebab = kebabCase(normalizeText(tab.name)); // contatos, anexos, etc
        const tabKebabSingular = tabKebab.replace(/s$/, ''); // contato, anexo (sem 's')
        
        const possibilities = [
            `${screenKebab}-${tabKebabSingular}.ts`,             // conta-contato.ts (PRIORITÁRIO - SINGULAR)
            `${screenKebab}-${tabKebab}.ts`,                     // conta-contatos.ts (plural)
            `${screenKebab}-${tabKebabSingular.split('-').reverse().join('-')}.ts`, // conta-empresa-grupo.ts (REVERSO)
            `${tabKebabSingular}.ts`,                            // contato.ts
            `${tabKebab}.ts`,                                    // contatos.ts
            `${cleanScreenName}${cleanTabName}Modelo.ts`,        // ContaContatoModelo.ts
            `${cleanScreenName}${cleanTabName}sModelo.ts`,       // ContaContatosModelo.ts
            `${cleanTabName}Modelo.ts`,                          // ContatoModelo.ts
            `${cleanTabName}sModelo.ts`                          // ContatosModelo.ts
        ];

        for (const name of possibilities) {
             triedNames.push(name);
             if (existingModels.has(name)) {
                 targetModelContent = existingModels.get(name);
                 targetModelName = name;
                 break;
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

        if (ruleIssues.length > 0) {
           report.push(`\n**⚠️ Discrepâncias de Regras:**`);
           ruleIssues.forEach(r => report.push(`- ${r}`));
        }
    }
});


// 5. Auditoria de UI (Arquivos TSX)
console.log('Auditando UI...');
report.push(`\n## 2. Verificação de Interface (UI)`);

// Caminho das Pages
// Tenta plural e singular
let pageDirName = kebabCase(SCREEN);
const pagesBase = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'pages');
if (!fs.existsSync(path.join(pagesBase, pageDirName))) {
     pageDirName = pageDirName.replace(/s$/, ''); // Remove S
}
const tabsDir = path.join(pagesBase, pageDirName, 'form', 'tabs');

tabsData.forEach(tab => {
    report.push(`\n### Aba: ${tab.name}`);
    
    // Tenta achar o arquivo da aba
    let tabFile = null;
    let tabFilePath = '';

    if (fs.existsSync(tabsDir)) {
        const normalizedTab = kebabCase(normalizeText(tab.name));
        const possibilities = [
            `${normalizedTab}.tsx`,
            path.join(normalizedTab, 'index.tsx'),
            path.join(normalizedTab.replace('s', ''), 'index.tsx') // singular folder
        ];

        // Caso especial: Aba Principal pode ser o index do form ou tabs/index
        if (tab.name === 'Principal' || tab.name === 'Conta') {
             possibilities.unshift('index.tsx'); // tabs/index.tsx
             // possibilities.push('../index.tsx'); // removed wrapper check to avoid false positives
        }

        for (const p of possibilities) {
            const tryPath = path.join(tabsDir, p);
            if (fs.existsSync(tryPath)) {
                tabFile = fs.readFileSync(tryPath, 'utf-8');
                tabFilePath = tryPath;
                break;
            }
        }
    }

    if (!tabFile) {
        report.push(`❌ **Arquivo da Aba NÃO encontrado** em \`${tabsDir}\``);
        if (tab.fields.length > 0) {
            report.push(`  - ❗ ${tab.fields.length} campos não estão mapeados na UI.`);
        }
    } else {
        report.push(`✅ **Arquivo:** \`${path.relative(FRONT_SRC, tabFilePath)}\``);
        
        // 1. Verificar TabName no componente
        // Padrão esperado: tabName="Descricao" ou tabName={t('...')}
        // A comparação exata é difícil por causa de i18n, mas vamos checar a prop em si.
        if (!tabFile.includes('tabName=')) {
            report.push(`- ⚠️ **Alerta:** Propriedade \`tabName\` não detectada explicitamente.`);
        }

        // 2. Verificar Campos (Register)
        const missingUI = [];
        tab.fields.forEach(f => {
            let key = camelCase(f.key);
             // Regra para remover Id do key se for um objeto relacionado (ex: GrupoEconomicoId -> grupoEconomico)
             let keyWithoutId = null;
             if (key.endsWith('Id')) {
                 keyWithoutId = key.slice(0, -2);
             }

             // Procura register('key') ou register("key")
             const regex = new RegExp(`register\\(['"]${key}['"]\\)`, 'i');
             const regexNoId = keyWithoutId ? new RegExp(`register\\(['"]${keyWithoutId}['"]\\)`, 'i') : null;
             
             // Também procura Control (Selects) -> name="key"
             const controlRegex = new RegExp(`name=["']${key}["']`, 'i');
             const controlRegexNoId = keyWithoutId ? new RegExp(`name=["']${keyWithoutId}['"]`, 'i') : null;

             if (!regex.test(tabFile) && !controlRegex.test(tabFile)) {
                 if (!keyWithoutId || (!regexNoId.test(tabFile) && !controlRegexNoId.test(tabFile))) {
                     missingUI.push(f.key);
                 }
             }
         });

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


// 6. Auditoria de Serviço (Básico)
console.log('Auditando Serviços...');
report.push(`\n## 3. Verificação de Serviços`);
let servicesDir = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', pageDirName);
if (!fs.existsSync(servicesDir)) {
    const modulePascal = MODULE.charAt(0).toUpperCase() + MODULE.slice(1).toLowerCase();
    const tryPascalInfo = path.join(FRONT_SRC, `@${modulePascal}`, 'services', pageDirName);
    if (fs.existsSync(tryPascalInfo)) {
        servicesDir = tryPascalInfo;
    } else {
        // Tenta remover 's' final do pageDirName (ex: contas -> conta)
        const singularPageDir = pageDirName.replace(/s$/, '');
        const trySingular = path.join(FRONT_SRC, `@${MODULE.toLowerCase()}`, 'services', singularPageDir);
        
         if (fs.existsSync(trySingular)) {
            servicesDir = trySingular;
        } else {
             // Tenta com @CRM maiúsculo
             const tryUpper = path.join(FRONT_SRC, `@${MODULE.toUpperCase()}`, 'services', singularPageDir);
             if (fs.existsSync(tryUpper)) {
                servicesDir = tryUpper;
             }
        }
    }
}

if (fs.existsSync(servicesDir)) {
    const serviceFiles = fs.readdirSync(servicesDir).filter(f => f.toLowerCase().endsWith('service.ts'));
    if (serviceFiles.length > 0) {
        report.push(`✅ **Serviços Encontrados:**`);
        serviceFiles.forEach(s => {
             report.push(`- \`${s}\``);
             // Poderia ler o arquivo e checar rotas, mas por enquanto basta saber que existe
        });
    } else {
         report.push(`❌ Nenhum arquivo *Service.ts encontrado em \`${servicesDir}\``);
    }
} else {
    report.push(`❌ Diretório de serviços não encontrado: \`${servicesDir}\``);
}

// Salvar Relatório
const reportPath = path.join(OUTPUT_DIR, `auditoria_detalhada_${SCREEN}.md`);
fs.writeFileSync(reportPath, report.join('\n'));
console.log(`\n✅ Relatório Detalhado salvo em: ${reportPath}`);

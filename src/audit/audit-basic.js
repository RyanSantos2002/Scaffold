const fs = require('fs');
const path = require('path');

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
const normalizeText = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

// Carregar Configuração
if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Configuração não encontrada em: ${CONFIG_PATH}`);
    process.exit(1);
}
const config = require(CONFIG_PATH);
const MODULE = config.modulo;
const SCREEN = config.tela;

// Determinar caminhos de arquivos gerados
// Determinar caminhos de arquivos gerados
const MODULE_LOWER = MODULE.toLowerCase();
// Tenta encontrar diretório do módulo (Case Insensitive)
const srcDirEntries = fs.readdirSync(FRONT_SRC, { withFileTypes: true });
const moduleEntry = srcDirEntries.find(dirent => dirent.isDirectory() && dirent.name.toLowerCase() === `@${MODULE_LOWER}`);
const moduleDirName = moduleEntry ? moduleEntry.name : `@${MODULE}`; // Fallback

// Tenta encontrar diretório da página (Singular ou Plural)
const pagesBasePath = path.join(FRONT_SRC, moduleDirName, 'pages');
let pageDirName = kebabCase(SCREEN); // Padrão: plural (Ex: contas)

if (fs.existsSync(pagesBasePath)) {
    const pageEntries = fs.readdirSync(pagesBasePath, { withFileTypes: true });
    // Tenta exato com kebabCase
    let foundPage = pageEntries.find(d => d.isDirectory() && d.name === kebabCase(SCREEN));
    
    if (!foundPage) {
        // Tenta singular
        const singularName = kebabCase(SCREEN).replace(/s$/, '');
        foundPage = pageEntries.find(d => d.isDirectory() && d.name === singularName);
        if (foundPage) pageDirName = foundPage.name;
    } else {
        pageDirName = foundPage.name;
    }
}

const paths = {
    metadata: path.join(CAPTURE_DIR, '..', 'output', 'html', MODULE, config.menuPai, `${SCREEN}_metadata.json`),
    servicesDir: path.join(FRONT_SRC, moduleDirName, 'services', pageDirName), 
    modelsDir: path.join(FRONT_SRC, 'common', 'core', 'models', MODULE.toLowerCase()),
    pagesDir: path.join(FRONT_SRC, moduleDirName, 'pages', pageDirName, 'form'),
};

console.log(`Auditing Screen: ${SCREEN} (${MODULE})`);

// Ler Metadata JSON
if (!fs.existsSync(paths.metadata)) {
    console.error(`Metadata JSON não encontrado em: ${paths.metadata}`);
    process.exit(1);
}
const metadata = JSON.parse(fs.readFileSync(paths.metadata, 'utf-8'));

// Estrutura do Relatório
const report = {
    header: `# Auditoria Automática: ${MODULE} / ${SCREEN}\n**Data:** ${new Date().toLocaleString()}\n`,
    models: [],
    ui: [],
    rules: [],
    summary: { totalFields: 0, missingModel: 0, missingUI: 0 }
};

// --- AUDITORIA DE MODELS ---
function auditModel() {
    console.log('Auditing Models...');
    // Tentativa de achar o arquivo do model principal.
    // O nome do model vem no json (ex: ContaModelo), mas o arquivo geralmente é o nome da tela no singular ou algo similar.
    // Vamos tentar buscar pelo nome da tela no singular (kebab-case).
    // Ex: Screen 'Contas' -> Model File 'conta.ts'
    let modelFileName = kebabCase(SCREEN);
    if (modelFileName.endsWith('s')) modelFileName = modelFileName.slice(0, -1); // Heurística simples plural -> singular

    const modelFilePath = path.join(paths.modelsDir, `${modelFileName}.ts`);
    
    report.models.push(`## 1. Auditoria de Modelo (Backend/Frontend)\n`);
    report.models.push(`**Arquivo Esperado:** \`${modelFilePath}\``);

    if (!fs.existsSync(modelFilePath)) {
        report.models.push(`❌ **Arquivo NÃO Encontrado!**\n`);
        report.summary.missingModel += metadata.fields.length;
        return;
    }

    report.models.push(`✅ **Arquivo Encontrado.**\n`);
    const modelContent = fs.readFileSync(modelFilePath, 'utf-8');

    const missingFields = [];
    metadata.fields.forEach(field => {
        report.summary.totalFields++;
        // Verifica se a propriedade existe na classe (key + ?) ou (key:)
        // Ex: razaoSocial?: string;
        const key = camelCase(field.key);
        const regex = new RegExp(`${key}\\??\\s*:`, 'i');
        
        if (!regex.test(modelContent)) {
            missingFields.push(field.key);
            console.warn(`[Model] Missing field: ${field.key}`);
        } else {
             // Extrair regras se possível
             // Ex: @MaxLength(500)
             // Vamos varrer o arquivo buscando decorators acima do campo
             const fieldBlock = modelContent.split(key)[0].split('\n').slice(-5).join('\n'); // 5 linhas antes
             if (field.required && !fieldBlock.includes('@Required')) {
                 report.rules.push(`⚠️ Campo **${field.label}** (${key}) é Required no JSON mas não tem @Required no Model.`);
             }
             if (field.maxLength) {
                 if (!fieldBlock.includes(`@MaxLength(${field.maxLength})`)) {
                     report.rules.push(`⚠️ Campo **${field.label}** (${key}) tem MaxLength(${field.maxLength}) no JSON mas não verificado no Model.`);
                 } else {
                     report.rules.push(`✅ Regra: **${field.label}** MaxLength(${field.maxLength}) detectada.`);
                 }
             }
        }
    });

    if (missingFields.length > 0) {
        report.models.push(`### ❌ Campos Faltantes no Model:\n`);
        missingFields.forEach(f => report.models.push(`- [ ] \`${f}\``));
        report.summary.missingModel += missingFields.length;
    } else {
        report.models.push(`✅ **Todos os ${metadata.fields.length} campos mapeados no Model.**\n`);
    }
}

// --- AUDITORIA DE UI (ABAS) ---
function auditUI() {
    console.log('Auditing UI...');
    report.ui.push(`## 2. Auditoria de Interface (Abas e Campos)\n`);
    
    metadata.tabs.forEach((tab, index) => {
        let tabLocation = 'Desconhecida';
        let tabContent = '';
        let tabStatus = '❌ Não Encontrada';
        
        // Normalização de nomes para busca
        const normalizedTabName = normalizeText(tab.name); 
        const brokenTabName = tab.name.toLowerCase().replace(/ç/g, '').replace(/ó/g, '').replace(/\s+/g, '-');
        
        // Lista expandida de caminhos possíveis
        const possiblePaths = [
            path.join(paths.pagesDir, 'tabs', kebabCase(tab.name), 'index.tsx'),
            path.join(paths.pagesDir, 'tabs', normalizedTabName, 'index.tsx'),
            path.join(paths.pagesDir, 'tabs', brokenTabName, 'index.tsx'),
            path.join(paths.pagesDir, 'tabs', `${kebabCase(tab.name)}.tsx`)
        ];
        
        // Regra específica do Usuário: A aba principal tem o nome da tela e fica dentro de tabs/
        // E também pode ser o tabs/index.tsx
        if (tab.name === 'Principal' || index === 0) {
            const screenNameKebab = kebabCase(SCREEN);
            // Prioridade máxima: tabs/contas.tsx (exemplo)
            possiblePaths.unshift(path.join(paths.pagesDir, 'tabs', `${screenNameKebab}.tsx`));
            possiblePaths.unshift(path.join(paths.pagesDir, 'tabs', screenNameKebab, 'index.tsx'));
            possiblePaths.unshift(path.join(paths.pagesDir, 'tabs', 'index.tsx')); // Main tab fallback
        }

        for (const p of possiblePaths) {
            if (fs.existsSync(p)) {
                const stat = fs.statSync(p);
                if (stat.size > 50) { 
                    tabLocation = p;
                    tabContent = fs.readFileSync(p, 'utf-8');
                    tabStatus = '✅ Encontrada';
                    break;
                } else {
                     tabStatus = '⚠️ Arquivo Existe mas Vazio';
                     tabLocation = p;
                }
            }
        }
        
        report.ui.push(`### Aba: ${tab.name} (${tab.hasGrid ? 'Com Grid' : 'Formulário'})`);
        report.ui.push(`- **Status:** ${tabStatus}`);
        report.ui.push(`- **Local:** \`${tabLocation}\``);

        if (tabStatus.includes('Encontrada')) {
            // CHECAGEM DE PROPS (TabName)
            if (!tabContent.includes(`tabName="${tab.name}"`) && !tabContent.includes(`tabName='${tab.name}'`) && !tabContent.includes("tabName={t('")) {
                 report.ui.push(`- ❌ **Prop \`tabName\` ausente!** (Esperado: \`tabName="${tab.name}"\`)`);
                 report.summary.missingUI++; // Incrementa contagem de erros UI
            } else {
                 report.ui.push(`- ✅ Prop \`tabName\` detectada.`);
            }

            // CHECAGEM DE CAMPOS
            if (index === 0) {
                 const missingUIFields = [];
                 metadata.fields.forEach(field => {
                     const key = camelCase(field.key);
                     const regex = new RegExp(`register\\(['"]${key}['"]\\)`, 'i');
                     if (!regex.test(tabContent)) {
                         missingUIFields.push(field.key);
                     }
                 });
                 if (missingUIFields.length > 0) {
                     report.ui.push(`- **❌ Campos Faltantes na UI:**`);
                     missingUIFields.forEach(f => report.ui.push(`  - [ ] ${f}`));
                     report.summary.missingUI += missingUIFields.length;
                 }
            } else {
                if (tab.hasGrid) {
                     if (tabContent.includes('DataGrids')) {
                         report.ui.push(`- **✅ Grid Detectada.**`);
                     } else {
                         report.ui.push(`- **⚠️ Grid NÃO detectada no arquivo.**`);
                     }
                }
            }
        }
        report.ui.push('\n');
    });
}

// --- AUDITORIA DE SERVICES ---
function auditServices() {
    console.log('Auditing Services...');
    report.ui.push(`## 3. Auditoria de Services (Rotas)\n`); // Reusing UI section or creating new
    
    // Tenta encontrar diretório de services (Singular ou Plural)
    let finalServicesDir = paths.servicesDir;
    if (!fs.existsSync(finalServicesDir)) {
        // Tenta singular
        const singularDir = path.join(FRONT_SRC, `@${MODULE}`, 'services', kebabCase(SCREEN).replace(/s$/, ''));
        if (fs.existsSync(singularDir)) {
             finalServicesDir = singularDir;
        }
    }

    // Lista todos os arquivos de service no diretório
    if (fs.existsSync(finalServicesDir)) {
        const serviceFiles = fs.readdirSync(finalServicesDir).filter(f => f.endsWith('.ts'));
        
        serviceFiles.forEach(file => {
            const filePath = path.join(finalServicesDir, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const issues = [];
            
            // Checa rotas vazias: key: "" ou key: " "
            const emptyRoutes = content.match(/(\w+):\s*["']\s*["']/g);
            if (emptyRoutes) {
                issues.push(`Rotas vazias detectadas: ${emptyRoutes.join(', ')}`);
            }
            
            // Checa controller
            if (!content.includes('controller:')) {
                issues.push('Controller não definido.');
            }

            if (issues.length > 0) {
                report.ui.push(`### ⚠️ Service Problemático: \`${file}\``);
                issues.forEach(i => report.ui.push(`- ${i}`));
                report.summary.missingUI++; // Contabiliza como erro geral de frontend
            } else {
                // report.ui.push(`### ✅ Service Ok: \`${file}\``); 
            }
        });
    } else {
        report.ui.push(`❌ Diretório de Services não encontrado: ${paths.servicesDir}`);
    }
    report.ui.push('\n');
}

// --- EXECUÇÃO ---
// --- REGRAS DE NEGÓCIO ---
function extractBusinessRules() {
    report.rules.push(`## 3. Regras de Negócio Identificadas\n`);
    report.rules.push(`| Campo | Regra | Valor | Origem |`);
    report.rules.push(`|---|---|---|---|`);
    
    metadata.fields.forEach(field => {
        if (field.required) {
            report.rules.push(`| ${field.label} | Obrigatório | Sim | HTML/Required |`);
        }
        if (field.maxLength) {
            report.rules.push(`| ${field.label} | Tamanho Máx | ${field.maxLength} | HTML/MaxLength |`);
        }
        // Tenta inferir tipo
        if (field.type === 'checkbox' || field.component === 'Switch') {
             report.rules.push(`| ${field.label} | Tipo | Booleano (Sim/Não) | Componente |`);
        }
    });
    
    report.rules.push('\n');
}

// --- EXECUÇÃO ---
try {
    auditModel();
    auditUI();
    auditServices(); 
    extractBusinessRules();

    // Final Report Assembly
    let finalMarkdown = report.header;
    finalMarkdown += `\n### Resumo\n- **Total de Campos Esperados:** ${report.summary.totalFields}\n- **Campos Faltantes no Model:** ${report.summary.missingModel}\n- **Campos Faltantes na UI:** ${report.summary.missingUI}\n\n`;
    finalMarkdown += report.models.join('\n');
    finalMarkdown += report.ui.join('\n');
    finalMarkdown += report.rules.join('\n');
    
    const reportPath = path.join(OUTPUT_DIR, `auditoria_automatica_${SCREEN}.md`);
    fs.writeFileSync(reportPath, finalMarkdown);
    console.log(`Relatório salvo em: ${reportPath}`);
    
} catch (error) {
    console.error("Erro fatal durante auditoria:", error);
}

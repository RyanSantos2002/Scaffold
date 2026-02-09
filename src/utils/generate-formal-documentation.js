const fs = require('fs');
const path = require('path');

/**
 * Gerador de Documentação Técnica Formal
 * Sistema de Migração M8 ERP - Frontend Modernization
 * 
 * @description Script automatizado para geração de documentação técnica
 * conforme padrões corporativos de documentação de software
 * @version 2.0.0
 * @author Equipe de Desenvolvimento M8
 */

const PATHS = {
    frontM8: 'C:/Fontes/FrontM8',
    scaffoldLog: '../Projeto-Scaffolding/generated-files.json',
    outputJson: './output/json',
    regrasNegocio: './docs/regras-negocio',
    outputDoc: './docs/documentacao-tecnica.md'
};

const CONFIG = {
    projectName: 'Sistema M8 ERP',
    projectVersion: '8.0',
    company: 'M8 Sistemas',
    documentType: 'Documentação Técnica de Migração Frontend',
    confidentiality: 'CONFIDENCIAL - USO INTERNO'
};

// Função para ler o log de arquivos gerados
function readGeneratedFiles() {
    try {
        const logPath = path.resolve(__dirname, '../../', PATHS.scaffoldLog);
        if (!fs.existsSync(logPath)) {
            console.log('⚠️  Arquivo generated-files.json não encontrado');
            return [];
        }
        const content = fs.readFileSync(logPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ Erro ao ler generated-files.json:', error.message);
        return [];
    }
}

// Função para listar JSONs processados
function listProcessedJsons() {
    try {
        const jsonDir = path.resolve(__dirname, '../../', PATHS.outputJson);
        if (!fs.existsSync(jsonDir)) {
            console.log('⚠️  Diretório output/json não encontrado');
            return [];
        }
        
        const files = [];
        function scanDir(dir) {
            const items = fs.readdirSync(dir);
            items.forEach(item => {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (item.endsWith('.json')) {
                    files.push({
                        name: item,
                        path: fullPath,
                        modified: stat.mtime
                    });
                }
            });
        }
        scanDir(jsonDir);
        return files;
    } catch (error) {
        console.error('❌ Erro ao listar JSONs:', error.message);
        return [];
    }
}

// Função para listar regras de negócio documentadas
function listBusinessRules() {
    try {
        const rulesDir = path.resolve(__dirname, '../../', PATHS.regrasNegocio);
        if (!fs.existsSync(rulesDir)) {
            console.log('⚠️  Diretório regras-negocio não encontrado');
            return [];
        }
        
        const files = fs.readdirSync(rulesDir)
            .filter(f => f.endsWith('.md'))
            .map(f => ({
                name: f.replace('.md', ''),
                path: path.join(rulesDir, f),
                content: fs.readFileSync(path.join(rulesDir, f), 'utf-8')
            }));
        
        return files;
    } catch (error) {
        console.error('❌ Erro ao listar regras de negócio:', error.message);
        return [];
    }
}

// Função para agrupar arquivos por módulo
function groupFilesByModule(files) {
    const modules = {};
    files.forEach(file => {
        const match = file.match(/@(\w+)\//);
        const moduleName = match ? match[1] : 'Common';
        if (!modules[moduleName]) modules[moduleName] = [];
        modules[moduleName].push(file);
    });
    return modules;
}

// Função para gerar documentação formal
function generateFormalDocumentation() {
    console.log('📝 Gerando documentação técnica formal...\n');
    
    const generatedFiles = readGeneratedFiles();
    const processedJsons = listProcessedJsons();
    const businessRules = listBusinessRules();
    const moduleGroups = groupFilesByModule(generatedFiles);
    
    const now = new Date();
    const dateStr = now.toLocaleDateString('pt-BR');
    const timeStr = now.toLocaleTimeString('pt-BR');
    
    let doc = '';
    
    // Cabeçalho Formal
    doc += `# ${CONFIG.documentType}\n\n`;
    doc += `**${CONFIG.projectName} - Versão ${CONFIG.projectVersion}**\n\n`;
    doc += `---\n\n`;
    
    // Informações do Documento
    doc += `## Informações do Documento\n\n`;
    doc += `| Atributo | Valor |\n`;
    doc += `|----------|-------|\n`;
    doc += `| **Título** | ${CONFIG.documentType} |\n`;
    doc += `| **Projeto** | ${CONFIG.projectName} |\n`;
    doc += `| **Versão** | ${CONFIG.projectVersion} |\n`;
    doc += `| **Empresa** | ${CONFIG.company} |\n`;
    doc += `| **Data de Geração** | ${dateStr} às ${timeStr} |\n`;
    doc += `| **Classificação** | ${CONFIG.confidentiality} |\n`;
    doc += `| **Geração** | Automática via Script |\n\n`;
    
    doc += `---\n\n`;
    
    // Controle de Versões
    doc += `## Controle de Versões\n\n`;
    doc += `| Versão | Data | Autor | Descrição |\n`;
    doc += `|--------|------|-------|----------|\n`;
    doc += `| 1.0 | ${dateStr} | Sistema Automatizado | Versão inicial gerada automaticamente |\n\n`;
    
    doc += `---\n\n`;
    
    // Sumário Executivo
    doc += `## 1. Sumário Executivo\n\n`;
    doc += `### 1.1 Objetivo\n\n`;
    doc += `Este documento apresenta a documentação técnica consolidada do projeto de migração do frontend do ${CONFIG.projectName}, `;
    doc += `detalhando as telas migradas, componentes gerados, regras de negócio implementadas e métricas do projeto.\n\n`;
    
    doc += `### 1.2 Escopo\n\n`;
    doc += `O escopo deste documento abrange:\n\n`;
    doc += `- Inventário completo de telas migradas\n`;
    doc += `- Mapeamento de componentes e serviços gerados\n`;
    doc += `- Documentação de regras de negócio\n`;
    doc += `- Métricas e indicadores do projeto\n`;
    doc += `- Arquitetura e padrões utilizados\n\n`;
    
    doc += `### 1.3 Indicadores Gerais\n\n`;
    doc += `| Indicador | Quantidade |\n`;
    doc += `|-----------|------------|\n`;
    doc += `| Telas Migradas | ${processedJsons.length} |\n`;
    doc += `| Componentes Gerados | ${generatedFiles.length} |\n`;
    doc += `| Módulos Afetados | ${Object.keys(moduleGroups).length} |\n`;
    doc += `| Regras de Negócio Documentadas | ${businessRules.length} |\n\n`;
    
    doc += `---\n\n`;
    
    // Inventário de Telas
    doc += `## 2. Inventário de Telas Migradas\n\n`;
    doc += `### 2.1 Visão Geral\n\n`;
    doc += `Total de telas processadas e migradas: **${processedJsons.length}**\n\n`;
    
    if (processedJsons.length > 0) {
        doc += `### 2.2 Detalhamento por Tela\n\n`;
        
        processedJsons.forEach((json, index) => {
            const screenName = json.name.replace('.json', '');
            const relatedFiles = generatedFiles.filter(f => 
                f.toLowerCase().includes(screenName.toLowerCase())
            );
            
            doc += `#### 2.2.${index + 1} ${screenName}\n\n`;
            doc += `**Informações Gerais:**\n\n`;
            doc += `| Atributo | Valor |\n`;
            doc += `|----------|-------|\n`;
            doc += `| Nome da Tela | ${screenName} |\n`;
            doc += `| Arquivo de Especificação | \`${json.name}\` |\n`;
            doc += `| Data de Processamento | ${json.modified.toLocaleString('pt-BR')} |\n`;
            doc += `| Componentes Gerados | ${relatedFiles.length} |\n`;
            doc += `| Localização do JSON | \`${json.path}\` |\n\n`;
            
            if (relatedFiles.length > 0) {
                doc += `**Componentes Gerados:**\n\n`;
                
                const models = relatedFiles.filter(f => f.includes('\\models\\'));
                const services = relatedFiles.filter(f => f.includes('\\services\\'));
                const pages = relatedFiles.filter(f => f.includes('\\pages\\'));
                const grids = relatedFiles.filter(f => f.includes('\\grids\\'));
                
                if (models.length > 0) {
                    doc += `- **Models (${models.length}):**\n`;
                    models.forEach(m => doc += `  - \`${path.basename(m)}\`\n`);
                    doc += `\n`;
                }
                
                if (services.length > 0) {
                    doc += `- **Services (${services.length}):**\n`;
                    services.forEach(s => doc += `  - \`${path.basename(s)}\`\n`);
                    doc += `\n`;
                }
                
                if (pages.length > 0) {
                    doc += `- **Pages/Forms (${pages.length}):**\n`;
                    pages.forEach(p => doc += `  - \`${path.basename(p)}\`\n`);
                    doc += `\n`;
                }
                
                if (grids.length > 0) {
                    doc += `- **Grids (${grids.length}):**\n`;
                    grids.forEach(g => doc += `  - \`${path.basename(g)}\`\n`);
                    doc += `\n`;
                }
            }
            
            doc += `---\n\n`;
        });
    } else {
        doc += `*Nenhuma tela processada no período.*\n\n`;
    }
    
    // Arquitetura e Componentes
    doc += `## 3. Arquitetura e Componentes\n\n`;
    doc += `### 3.1 Distribuição por Módulo\n\n`;
    
    if (Object.keys(moduleGroups).length > 0) {
        doc += `| Módulo | Componentes | Percentual |\n`;
        doc += `|--------|-------------|------------|\n`;
        
        Object.keys(moduleGroups).sort().forEach(module => {
            const count = moduleGroups[module].length;
            const percentage = ((count / generatedFiles.length) * 100).toFixed(1);
            doc += `| ${module} | ${count} | ${percentage}% |\n`;
        });
        doc += `\n`;
        
        doc += `### 3.2 Detalhamento por Módulo\n\n`;
        
        Object.keys(moduleGroups).sort().forEach(module => {
            doc += `#### 3.2.${Object.keys(moduleGroups).indexOf(module) + 1} Módulo ${module}\n\n`;
            doc += `Total de componentes: **${moduleGroups[module].length}**\n\n`;
            
            const byType = {};
            moduleGroups[module].forEach(file => {
                const ext = path.extname(file);
                if (!byType[ext]) byType[ext] = [];
                byType[ext].push(file);
            });
            
            Object.keys(byType).sort().forEach(type => {
                doc += `- **${type}** (${byType[type].length} arquivos)\n`;
            });
            doc += `\n`;
        });
    }
    
    doc += `### 3.3 Distribuição por Tipo de Componente\n\n`;
    
    const byType = {};
    generatedFiles.forEach(file => {
        const ext = path.extname(file);
        const type = ext || 'outros';
        if (!byType[type]) byType[type] = [];
        byType[type].push(file);
    });
    
    doc += `| Tipo | Quantidade | Percentual |\n`;
    doc += `|------|------------|------------|\n`;
    
    Object.keys(byType).sort().forEach(type => {
        const count = byType[type].length;
        const percentage = ((count / generatedFiles.length) * 100).toFixed(1);
        doc += `| ${type} | ${count} | ${percentage}% |\n`;
    });
    doc += `\n`;
    
    doc += `---\n\n`;
    
    // Regras de Negócio
    doc += `## 4. Regras de Negócio\n\n`;
    doc += `### 4.1 Visão Geral\n\n`;
    doc += `Total de documentos de regras de negócio: **${businessRules.length}**\n\n`;
    
    if (businessRules.length > 0) {
        doc += `### 4.2 Documentação por Tela\n\n`;
        
        businessRules.forEach((rule, index) => {
            const ruleName = rule.name.charAt(0).toUpperCase() + rule.name.slice(1);
            doc += `#### 4.2.${index + 1} ${ruleName}\n\n`;
            doc += `**Localização:** [\`regras-negocio/${rule.name}.md\`](./regras-negocio/${rule.name}.md)\n\n`;
            doc += `**Resumo:**\n\n`;
            
            const lines = rule.content.split('\n').filter(l => l.trim());
            const summary = lines.slice(0, 8).join('\n');
            doc += `\`\`\`\n${summary}\n[...]\n\`\`\`\n\n`;
        });
    } else {
        doc += `*Nenhuma regra de negócio documentada no período.*\n\n`;
    }
    
    doc += `---\n\n`;
    
    // Métricas e Indicadores
    doc += `## 5. Métricas e Indicadores\n\n`;
    doc += `### 5.1 Indicadores de Produtividade\n\n`;
    doc += `| Métrica | Valor |\n`;
    doc += `|---------|-------|\n`;
    doc += `| Telas Migradas | ${processedJsons.length} |\n`;
    doc += `| Componentes Gerados | ${generatedFiles.length} |\n`;
    doc += `| Média de Componentes por Tela | ${processedJsons.length > 0 ? (generatedFiles.length / processedJsons.length).toFixed(1) : 0} |\n`;
    doc += `| Módulos Afetados | ${Object.keys(moduleGroups).length} |\n`;
    doc += `| Regras Documentadas | ${businessRules.length} |\n\n`;
    
    doc += `### 5.2 Distribuição Temporal\n\n`;
    doc += `| Período | Telas | Componentes |\n`;
    doc += `|---------|-------|-------------|\n`;
    doc += `| Total Acumulado | ${processedJsons.length} | ${generatedFiles.length} |\n\n`;
    
    doc += `---\n\n`;
    
    // Anexos
    doc += `## 6. Anexos\n\n`;
    doc += `### 6.1 Listagem Completa de Arquivos Gerados\n\n`;
    
    if (generatedFiles.length > 0) {
        Object.keys(byType).sort().forEach(type => {
            doc += `#### ${type} (${byType[type].length} arquivos)\n\n`;
            byType[type].forEach(file => {
                doc += `- \`${file}\`\n`;
            });
            doc += `\n`;
        });
    }
    
    doc += `---\n\n`;
    
    // Rodapé
    doc += `## 7. Informações Adicionais\n\n`;
    doc += `### 7.1 Glossário\n\n`;
    doc += `- **Model**: Classe TypeScript que representa a estrutura de dados\n`;
    doc += `- **Service**: Camada de serviço para comunicação com API\n`;
    doc += `- **Grid**: Componente de listagem/tabela de dados\n`;
    doc += `- **Form**: Componente de formulário para entrada de dados\n`;
    doc += `- **Page**: Página completa da aplicação\n\n`;
    
    doc += `### 7.2 Referências\n\n`;
    doc += `- Documentação do Projeto: \`docs/README.md\`\n`;
    doc += `- Padrões de Código: \`docs/padroes.md\`\n`;
    doc += `- Regras de Negócio: \`docs/regras-negocio/\`\n\n`;
    
    doc += `---\n\n`;
    
    // Salvar documentação
    const outputPath = path.resolve(__dirname, '../../', PATHS.outputDoc);
    fs.writeFileSync(outputPath, doc, 'utf-8');
    
    console.log('✅ Documentação técnica formal gerada com sucesso!');
    console.log(`📄 Arquivo: ${outputPath}\n`);
    
    // Estatísticas
    console.log('📊 Estatísticas:');
    console.log(`   - Telas: ${processedJsons.length}`);
    console.log(`   - Componentes: ${generatedFiles.length}`);
    console.log(`   - Módulos: ${Object.keys(moduleGroups).length}`);
    console.log(`   - Regras: ${businessRules.length}`);
}

// Executar
try {
    generateFormalDocumentation();
} catch (error) {
    console.error('❌ Erro ao gerar documentação:', error);
    process.exit(1);
}

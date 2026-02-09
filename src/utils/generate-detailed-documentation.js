const fs = require('fs');
const path = require('path');

/**
 * Gerador de Documentação Técnica Detalhada
 * Sistema de Migração M8 ERP - Frontend Modernization
 * 
 * @description Gera documentação técnica completa com detalhes de abas,
 * models, services, comportamentos e pendências
 * @version 3.0.0
 * @author Equipe de Desenvolvimento M8
 */

const PATHS = {
    frontM8: 'C:/Fontes/FrontM8',
    scaffoldLog: '../Projeto-Scaffolding/generated-files.json',
    outputJson: './output/json',
    regrasNegocio: './docs/regras-negocio',
    outputDoc: './docs/documentacao-tecnica-detalhada.md'
};

const CONFIG = {
    projectName: 'Sistema M8 ERP',
    projectVersion: '8.0',
    company: 'M8 Sistemas',
    documentType: 'Documentação Técnica Detalhada - Migração Frontend',
    confidentiality: 'CONFIDENCIAL - USO INTERNO'
};

// Função para ler JSONs com informações de abas
function readJsonWithTabs(jsonPath) {
    try {
        const content = fs.readFileSync(jsonPath, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error(`❌ Erro ao ler JSON ${jsonPath}:`, error.message);
        return null;
    }
}

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
                        modified: stat.mtime,
                        data: readJsonWithTabs(fullPath)
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

// Função para extrair ações das regras de negócio
function extractActions(ruleContent) {
    const actions = [];
    const lines = ruleContent.split('\n');
    let currentAction = null;
    
    lines.forEach(line => {
        // Detectar início de ação (### seguido de número)
        const actionMatch = line.match(/^###\s+\d+\.\s+\*\*(.+?)\*\*/);
        if (actionMatch) {
            if (currentAction) actions.push(currentAction);
            currentAction = { name: actionMatch[1], details: [] };
        }
        // Coletar detalhes da ação
        else if (currentAction && line.trim().startsWith('-')) {
            currentAction.details.push(line.trim());
        }
    });
    
    if (currentAction) actions.push(currentAction);
    return actions;
}

// Função para identificar pendências
function identifyPendencies(generatedFiles, jsonData) {
    const pendencies = [];
    
    // Verificar models vazios ou problemáticos
    const problematicModels = generatedFiles.filter(f => 
        f.includes('assistencia-tecnica\\.ts') || 
        f.includes('\\.ts') && f.endsWith('\\.ts')
    );
    
    if (problematicModels.length > 0) {
        pendencies.push({
            type: 'Model Problemático',
            description: 'Models gerados com problemas de nomenclatura ou vazios',
            files: problematicModels,
            priority: 'Alta'
        });
    }
    
    // Verificar abas sem implementação
    if (jsonData && jsonData.tabs) {
        jsonData.tabs.forEach(tab => {
            if (!tab.hasGrid && !tab.hasForm) {
                pendencies.push({
                    type: 'Aba Não Implementada',
                    description: `Aba "${tab.name}" sem grid nem formulário`,
                    files: [],
                    priority: 'Média'
                });
            }
            if (!tab.modelName || tab.modelName === '') {
                pendencies.push({
                    type: 'Model Ausente',
                    description: `Aba "${tab.name}" sem model definido`,
                    files: [],
                    priority: 'Alta'
                });
            }
        });
    }
    
    return pendencies;
}

// Função para gerar documentação detalhada
function generateDetailedDocumentation() {
    console.log('📝 Gerando documentação técnica detalhada...\n');
    
    const generatedFiles = readGeneratedFiles();
    const processedJsons = listProcessedJsons();
    const businessRules = listBusinessRules();
    
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
    doc += `| **Classificação** | ${CONFIG.confidentiality} |\n\n`;
    
    doc += `---\n\n`;
    
    // Sumário Executivo
    doc += `## 1. Sumário Executivo\n\n`;
    doc += `### 1.1 Visão Geral\n\n`;
    doc += `Este documento apresenta a documentação técnica detalhada do projeto de migração do frontend do ${CONFIG.projectName}, `;
    doc += `incluindo especificações completas de cada tela migrada, componentes gerados, comportamentos implementados e itens pendentes.\n\n`;
    
    doc += `### 1.2 Indicadores Gerais\n\n`;
    doc += `| Indicador | Quantidade |\n`;
    doc += `|-----------|------------|\n`;
    doc += `| Telas Migradas | ${processedJsons.length} |\n`;
    doc += `| Componentes Gerados | ${generatedFiles.length} |\n`;
    doc += `| Regras de Negócio Documentadas | ${businessRules.length} |\n\n`;
    
    doc += `---\n\n`;
    
    // Detalhamento por Tela
    doc += `## 2. Detalhamento por Tela\n\n`;
    
    if (processedJsons.length > 0) {
        processedJsons.forEach((json, index) => {
            const screenName = json.name.replace('.json', '');
            const jsonData = json.data;
            const relatedFiles = generatedFiles.filter(f => 
                f.toLowerCase().includes(screenName.toLowerCase())
            );
            
            doc += `### 2.${index + 1} ${screenName}\n\n`;
            
            // Informações Gerais
            doc += `#### 2.${index + 1}.1 Informações Gerais\n\n`;
            doc += `| Atributo | Valor |\n`;
            doc += `|----------|-------|\n`;
            doc += `| **Nome da Tela** | ${screenName} |\n`;
            doc += `| **Módulo** | ${jsonData?.createInModule || 'N/A'} |\n`;
            doc += `| **Data de Processamento** | ${json.modified.toLocaleString('pt-BR')} |\n`;
            doc += `| **Total de Abas** | ${jsonData?.tabs?.length || 0} |\n`;
            doc += `| **Componentes Gerados** | ${relatedFiles.length} |\n\n`;
            
            // Abas Implementadas
            if (jsonData && jsonData.tabs && jsonData.tabs.length > 0) {
                doc += `#### 2.${index + 1}.2 Abas Implementadas\n\n`;
                doc += `| # | Nome da Aba | Model | Grid | Form | Status |\n`;
                doc += `|---|-------------|-------|------|------|--------|\n`;
                
                jsonData.tabs.forEach((tab, tabIndex) => {
                    const hasGrid = tab.hasGrid ? '✅' : '❌';
                    const hasForm = tab.hasForm ? '✅' : '❌';
                    const hasModel = tab.modelName && tab.modelName !== '' ? '✅' : '⚠️';
                    let status = 'Completo';
                    if (!tab.hasGrid && !tab.hasForm) status = '⚠️ Pendente';
                    else if (!tab.modelName) status = '⚠️ Sem Model';
                    
                    doc += `| ${tabIndex + 1} | ${tab.name} | ${hasModel} | ${hasGrid} | ${hasForm} | ${status} |\n`;
                });
                doc += `\n`;
                
                // Detalhamento de cada aba
                doc += `#### 2.${index + 1}.3 Detalhamento das Abas\n\n`;
                jsonData.tabs.forEach((tab, tabIndex) => {
                    doc += `##### ${tab.name}\n\n`;
                    doc += `**Configuração:**\n\n`;
                    doc += `- **Model:** ${tab.modelName || '❌ Não definido'}\n`;
                    doc += `- **Grid:** ${tab.hasGrid ? '✅ Implementado' : '❌ Não implementado'}\n`;
                    doc += `- **Formulário:** ${tab.hasForm ? '✅ Implementado' : '❌ Não implementado'}\n\n`;
                });
            }
            
            // Models Gerados
            const models = relatedFiles.filter(f => f.includes('\\models\\'));
            if (models.length > 0) {
                doc += `#### 2.${index + 1}.4 Models Gerados\n\n`;
                models.forEach(model => {
                    const modelName = path.basename(model, '.ts');
                    doc += `- \`${modelName}\`\n`;
                    doc += `  - **Caminho:** \`${model}\`\n`;
                });
                doc += `\n`;
            }
            
            // Services Gerados
            const services = relatedFiles.filter(f => f.includes('\\services\\'));
            if (services.length > 0) {
                doc += `#### 2.${index + 1}.5 Services Gerados\n\n`;
                services.forEach(service => {
                    const serviceName = path.basename(service, '.ts');
                    doc += `- \`${serviceName}\`\n`;
                    doc += `  - **Caminho:** \`${service}\`\n`;
                });
                doc += `\n`;
            }
            
            // Componentes UI
            const pages = relatedFiles.filter(f => f.includes('\\pages\\'));
            const grids = relatedFiles.filter(f => f.includes('\\grids\\'));
            
            if (pages.length > 0 || grids.length > 0) {
                doc += `#### 2.${index + 1}.6 Componentes UI\n\n`;
                
                if (pages.length > 0) {
                    doc += `**Pages/Forms:**\n\n`;
                    pages.forEach(page => {
                        const pageName = path.basename(page, '.tsx');
                        doc += `- \`${pageName}\`\n`;
                    });
                    doc += `\n`;
                }
                
                if (grids.length > 0) {
                    doc += `**Grids:**\n\n`;
                    grids.forEach(grid => {
                        const gridName = path.basename(grid, '.tsx');
                        doc += `- \`${gridName}\`\n`;
                    });
                    doc += `\n`;
                }
            }
            
            // Comportamentos e Ações
            const relatedRule = businessRules.find(r => 
                r.name.toLowerCase() === screenName.toLowerCase()
            );
            
            if (relatedRule) {
                const actions = extractActions(relatedRule.content);
                
                if (actions.length > 0) {
                    doc += `#### 2.${index + 1}.7 Comportamentos e Ações\n\n`;
                    doc += `**Total de Ações Identificadas:** ${actions.length}\n\n`;
                    
                    actions.forEach((action, actionIndex) => {
                        doc += `##### ${actionIndex + 1}. ${action.name}\n\n`;
                        if (action.details.length > 0) {
                            action.details.forEach(detail => {
                                doc += `${detail}\n`;
                            });
                            doc += `\n`;
                        }
                    });
                }
                
                doc += `**Documentação Completa:** [regras-negocio/${relatedRule.name}.md](./regras-negocio/${relatedRule.name}.md)\n\n`;
            }
            
            // Pendências Identificadas
            const pendencies = identifyPendencies(relatedFiles, jsonData);
            if (pendencies.length > 0) {
                doc += `#### 2.${index + 1}.8 Pendências Identificadas\n\n`;
                doc += `| Prioridade | Tipo | Descrição | Arquivos Afetados |\n`;
                doc += `|------------|------|-----------|-------------------|\n`;
                
                pendencies.forEach(pend => {
                    const filesStr = pend.files.length > 0 ? pend.files.length : 'N/A';
                    doc += `| ${pend.priority} | ${pend.type} | ${pend.description} | ${filesStr} |\n`;
                });
                doc += `\n`;
            }
            
            doc += `---\n\n`;
        });
    }
    
    // Resumo de Pendências Globais
    doc += `## 3. Resumo de Pendências\n\n`;
    doc += `### 3.1 Pendências por Prioridade\n\n`;
    
    let allPendencies = [];
    processedJsons.forEach(json => {
        const pendencies = identifyPendencies(generatedFiles, json.data);
        allPendencies = allPendencies.concat(pendencies);
    });
    
    const highPriority = allPendencies.filter(p => p.priority === 'Alta');
    const mediumPriority = allPendencies.filter(p => p.priority === 'Média');
    const lowPriority = allPendencies.filter(p => p.priority === 'Baixa');
    
    doc += `| Prioridade | Quantidade |\n`;
    doc += `|------------|------------|\n`;
    doc += `| Alta | ${highPriority.length} |\n`;
    doc += `| Média | ${mediumPriority.length} |\n`;
    doc += `| Baixa | ${lowPriority.length} |\n`;
    doc += `| **Total** | **${allPendencies.length}** |\n\n`;
    
    if (allPendencies.length > 0) {
        doc += `### 3.2 Detalhamento de Pendências\n\n`;
        
        if (highPriority.length > 0) {
            doc += `#### Prioridade Alta\n\n`;
            highPriority.forEach((pend, idx) => {
                doc += `${idx + 1}. **${pend.type}:** ${pend.description}\n`;
            });
            doc += `\n`;
        }
        
        if (mediumPriority.length > 0) {
            doc += `#### Prioridade Média\n\n`;
            mediumPriority.forEach((pend, idx) => {
                doc += `${idx + 1}. **${pend.type}:** ${pend.description}\n`;
            });
            doc += `\n`;
        }
    } else {
        doc += `✅ **Nenhuma pendência identificada.**\n\n`;
    }
    
    doc += `---\n\n`;
    
    // Métricas
    doc += `## 4. Métricas e Indicadores\n\n`;
    doc += `| Métrica | Valor |\n`;
    doc += `|---------|-------|\n`;
    doc += `| Telas Migradas | ${processedJsons.length} |\n`;
    doc += `| Componentes Gerados | ${generatedFiles.length} |\n`;
    doc += `| Models | ${generatedFiles.filter(f => f.includes('\\models\\')).length} |\n`;
    doc += `| Services | ${generatedFiles.filter(f => f.includes('\\services\\')).length} |\n`;
    doc += `| Grids | ${generatedFiles.filter(f => f.includes('\\grids\\')).length} |\n`;
    doc += `| Forms/Pages | ${generatedFiles.filter(f => f.includes('\\pages\\')).length} |\n`;
    doc += `| Regras Documentadas | ${businessRules.length} |\n`;
    doc += `| Pendências Totais | ${allPendencies.length} |\n`;
    doc += `| Pendências Alta Prioridade | ${highPriority.length} |\n\n`;
    
    doc += `---\n\n`;
    
    // Referências
    doc += `## 5. Referências\n\n`;
    doc += `- Documentação do Projeto: \`docs/README.md\`\n`;
    doc += `- Padrões de Código: \`docs/padroes.md\`\n`;
    doc += `- Regras de Negócio: \`docs/regras-negocio/\`\n`;
    doc += `- Arquivos Gerados: \`Projeto-Scaffolding/generated-files.json\`\n\n`;
    
    doc += `---\n\n`;
    
    // Salvar documentação
    const outputPath = path.resolve(__dirname, '../../', PATHS.outputDoc);
    fs.writeFileSync(outputPath, doc, 'utf-8');
    
    console.log('✅ Documentação técnica detalhada gerada com sucesso!');
    console.log(`📄 Arquivo: ${outputPath}\n`);
    
    // Estatísticas
    console.log('📊 Estatísticas:');
    console.log(`   - Telas: ${processedJsons.length}`);
    console.log(`   - Componentes: ${generatedFiles.length}`);
    console.log(`   - Regras: ${businessRules.length}`);
    console.log(`   - Pendências: ${allPendencies.length} (${highPriority.length} alta prioridade)`);
}

// Executar
try {
    generateDetailedDocumentation();
} catch (error) {
    console.error('❌ Erro ao gerar documentação:', error);
    process.exit(1);
}

const fs = require('fs');
const path = require('path');

/**
 * Script para gerar documentação consolidada do projeto
 * Coleta informações de telas geradas, regras de negócio e métricas
 */

const PATHS = {
    frontM8: 'C:/Fontes/FrontM8',
    scaffoldLog: '../Projeto-Scaffolding/generated-files.json',
    outputJson: './output/json',
    regrasNegocio: './docs/regras-negocio',
    outputDoc: './docs/projeto-documentacao.md'
};

// Função para ler o log de arquivos gerados
function readGeneratedFiles() {
    try {
        const logPath = path.resolve(__dirname, '../../', PATHS.scaffoldLog);
        if (!fs.existsSync(logPath)) {
            console.log('⚠️ Arquivo generated-files.json não encontrado');
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
            console.log('⚠️ Diretório output/json não encontrado');
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
            console.log('⚠️ Diretório regras-negocio não encontrado');
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

// Função para gerar documentação markdown
function generateDocumentation() {
    console.log('📝 Gerando documentação do projeto...\n');
    
    const generatedFiles = readGeneratedFiles();
    const processedJsons = listProcessedJsons();
    const businessRules = listBusinessRules();
    
    let doc = `# Documentação do Projeto M8 Scaffolding\n\n`;
    doc += `> Gerado automaticamente em ${new Date().toLocaleString('pt-BR')}\n\n`;
    
    // Resumo Executivo
    doc += `## 📊 Resumo Executivo\n\n`;
    doc += `- **Telas Processadas:** ${processedJsons.length}\n`;
    doc += `- **Arquivos Gerados:** ${generatedFiles.length}\n`;
    doc += `- **Regras de Negócio Documentadas:** ${businessRules.length}\n\n`;
    
    // Telas Geradas
    doc += `## 🖥️ Telas Geradas\n\n`;
    
    if (processedJsons.length > 0) {
        processedJsons.forEach(json => {
            doc += `### ${json.name.replace('.json', '')}\n\n`;
            doc += `- **Arquivo JSON:** \`${json.name}\`\n`;
            doc += `- **Data de Processamento:** ${json.modified.toLocaleString('pt-BR')}\n`;
            doc += `- **Caminho:** \`${json.path}\`\n\n`;
            
            // Tentar encontrar arquivos gerados relacionados
            const screenName = json.name.replace('.json', '');
            const relatedFiles = generatedFiles.filter(f => 
                f.toLowerCase().includes(screenName.toLowerCase())
            );
            
            if (relatedFiles.length > 0) {
                doc += `#### Arquivos Gerados\n\n`;
                relatedFiles.forEach(file => {
                    doc += `- \`${file}\`\n`;
                });
                doc += `\n`;
            }
            
            doc += `---\n\n`;
        });
    } else {
        doc += `*Nenhuma tela processada encontrada.*\n\n`;
    }
    
    // Regras de Negócio
    doc += `## 📋 Regras de Negócio\n\n`;
    
    if (businessRules.length > 0) {
        businessRules.forEach(rule => {
            doc += `### ${rule.name.charAt(0).toUpperCase() + rule.name.slice(1)}\n\n`;
            doc += `[Ver documentação completa](./regras-negocio/${rule.name}.md)\n\n`;
            
            // Extrair resumo (primeiras linhas)
            const lines = rule.content.split('\n').filter(l => l.trim());
            const summary = lines.slice(0, 5).join('\n');
            doc += `\`\`\`\n${summary}\n...\n\`\`\`\n\n`;
            doc += `---\n\n`;
        });
    } else {
        doc += `*Nenhuma regra de negócio documentada.*\n\n`;
    }
    
    // Arquivos Gerados Detalhados
    if (generatedFiles.length > 0) {
        doc += `## 📁 Arquivos Gerados (Detalhado)\n\n`;
        doc += `Total: ${generatedFiles.length} arquivos\n\n`;
        
        // Agrupar por tipo
        const byType = {};
        generatedFiles.forEach(file => {
            const ext = path.extname(file);
            const type = ext || 'outros';
            if (!byType[type]) byType[type] = [];
            byType[type].push(file);
        });
        
        Object.keys(byType).sort().forEach(type => {
            doc += `### ${type} (${byType[type].length} arquivos)\n\n`;
            byType[type].forEach(file => {
                doc += `- \`${file}\`\n`;
            });
            doc += `\n`;
        });
    }
    
    // Métricas
    doc += `## 📈 Métricas\n\n`;
    doc += `| Métrica | Valor |\n`;
    doc += `|---------|-------|\n`;
    doc += `| Telas Processadas | ${processedJsons.length} |\n`;
    doc += `| Arquivos Gerados | ${generatedFiles.length} |\n`;
    doc += `| Regras Documentadas | ${businessRules.length} |\n`;
    doc += `| Data de Geração | ${new Date().toLocaleDateString('pt-BR')} |\n\n`;
    
    // Próximos Passos
    doc += `## 🎯 Próximos Passos\n\n`;
    doc += `- [ ] Revisar telas geradas\n`;
    doc += `- [ ] Validar regras de negócio\n`;
    doc += `- [ ] Testar workflows\n`;
    doc += `- [ ] Documentar novas telas\n\n`;
    
    // Salvar documentação
    const outputPath = path.resolve(__dirname, '../../', PATHS.outputDoc);
    fs.writeFileSync(outputPath, doc, 'utf-8');
    
    console.log('✅ Documentação gerada com sucesso!');
    console.log(`📄 Arquivo: ${outputPath}\n`);
    
    // Estatísticas
    console.log('📊 Estatísticas:');
    console.log(`   - Telas: ${processedJsons.length}`);
    console.log(`   - Arquivos: ${generatedFiles.length}`);
    console.log(`   - Regras: ${businessRules.length}`);
}

// Executar
try {
    generateDocumentation();
} catch (error) {
    console.error('❌ Erro ao gerar documentação:', error);
    process.exit(1);
}

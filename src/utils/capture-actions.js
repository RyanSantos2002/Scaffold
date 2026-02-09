const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

/**
 * Script para capturar ações e regras de negócio de HTMLs
 * Analisa botões, dependências, abas e comportamentos
 */

const PATHS = {
    htmlDir: './output/Form',
    outputDir: './docs/regras-negocio'
};

function analyzeHTML(htmlPath) {
    console.log(`📝 Analisando ${path.basename(htmlPath)}...`);
    
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const $ = cheerio.load(html);
    
    const screenName = path.basename(htmlPath, '.html').replace('cadastro_id_', '');
    const analysis = {
        screenName,
        actions: [],
        tabs: [],
        dependencies: [],
        formInfo: {}
    };
    
    // Extrair informações do formulário
    const form = $('form').first();
    if (form.length) {
        analysis.formInfo = {
            action: form.attr('action'),
            method: form.attr('method'),
            model: form.attr('model-name'),
            view: form.attr('view-name')
        };
    }
    
    // Extrair ações do menu
    $('.m8-acoes-formulario a').each((i, el) => {
        const $el = $(el);
        const onclick = $el.attr('onclick');
        const id = $el.attr('id');
        const icon = $el.find('i').attr('class');
        const text = $el.text().trim();
        
        if (onclick) {
            analysis.actions.push({
                name: text,
                button: id,
                function: onclick.replace(';return false;', ''),
                icon: icon
            });
        }
    });
    
    // Extrair abas
    $('#frmLancamentoTab li').each((i, el) => {
        const $el = $(el);
        const $link = $el.find('a');
        const tabName = $link.text().trim();
        const tabId = $link.attr('href');
        const isActive = $el.hasClass('active');
        const isHidden = $el.hasClass('hidden');
        const onclick = $el.attr('onclick');
        
        analysis.tabs.push({
            name: tabName,
            id: tabId,
            active: isActive,
            hidden: isHidden,
            behavior: onclick || 'N/A'
        });
    });
    
    // Extrair dependências de campos
    $('[data-dependente]').each((i, el) => {
        const $el = $(el);
        const fieldName = $el.attr('name') || $el.attr('id');
        const dependsOn = $el.attr('data-dependente');
        const isFormDependency = $el.attr('data-dependencia-formulario');
        
        analysis.dependencies.push({
            field: fieldName,
            dependsOn: dependsOn,
            formDependency: isFormDependency
        });
    });
    
    return analysis;
}

function generateMarkdownReport(analysis) {
    let md = `# ${analysis.screenName} - Documentação Técnica\n\n`;
    
    // Informações do Formulário
    if (analysis.formInfo.action) {
        const actionParts = analysis.formInfo.action?.split('/').filter(p => p);
        md += `**Formulário:** \`${actionParts?.[1]}/${actionParts?.[2]}\`  \n`;
        md += `**Model:** \`${analysis.formInfo.model}\`\n\n`;
    }
    
    md += `---\n\n`;
    
    // Ações
    if (analysis.actions.length > 0) {
        md += `## Ações (${analysis.actions.length})\n\n`;
        
        analysis.actions.forEach((action, index) => {
            md += `**${index + 1}. ${action.name}**\n`;
            md += `- Função: \`${action.function}\`\n`;
            md += `- Botão: \`${action.button}\`\n\n`;
        });
    }
    
    // Abas
    if (analysis.tabs.length > 0) {
        md += `## Abas (${analysis.tabs.length})\n\n`;
        
        analysis.tabs.forEach((tab, index) => {
            const status = tab.active ? 'Ativa' : 'Inativa';
            const visibility = !tab.hidden ? 'Visível' : 'Oculta';
            const type = tab.behavior.includes('AcaoGridExecutarCliqueAba') ? 'Grid' : 'Formulário';
            
            md += `**${index + 1}. ${tab.name}**\n`;
            md += `- Status: ${status} | ${visibility}\n`;
            md += `- Tipo: ${type}\n`;
            
            if (tab.behavior.includes('AcaoGridExecutarCliqueAba')) {
                const gridMatch = tab.behavior.match(/\['([^']+)'\]/);
                if (gridMatch) {
                    md += `- Grid: \`${gridMatch[1]}\`\n`;
                }
            }
            md += `\n`;
        });
    }
    
    // Dependências
    if (analysis.dependencies.length > 0) {
        md += `## Dependências de Campos (${analysis.dependencies.length})\n\n`;
        
        analysis.dependencies.forEach((dep, index) => {
            md += `**${index + 1}. ${dep.field}**\n`;
            md += `- Depende de: \`${dep.dependsOn}\`\n`;
            md += `- Descrição: O campo \`${dep.field}\` só carrega opções após selecionar \`${dep.dependsOn}\`\n`;
            md += `- Tipo: ${dep.formDependency === 'False' ? 'Select2 (Ajax)' : 'Formulário'}\n\n`;
        });
    }
    
    md += `---\n\n`;
    md += `*Gerado em ${new Date().toLocaleString('pt-BR')}*\n`;
    
    return md;
}

function main() {
    try {
        // Verificar se diretório de output existe
        if (!fs.existsSync(PATHS.outputDir)) {
            fs.mkdirSync(PATHS.outputDir, { recursive: true });
        }
        
        // Listar HTMLs
        const htmlFiles = fs.readdirSync(PATHS.htmlDir)
            .filter(f => f.endsWith('.html'))
            .map(f => path.join(PATHS.htmlDir, f));
        
        if (htmlFiles.length === 0) {
            console.log('⚠️  Nenhum arquivo HTML encontrado em', PATHS.htmlDir);
            return;
        }
        
        console.log(`\n📊 Encontrados ${htmlFiles.length} arquivo(s) HTML\n`);
        
        htmlFiles.forEach(htmlPath => {
            const analysis = analyzeHTML(htmlPath);
            const markdown = generateMarkdownReport(analysis);
            
            // Salvar relatório
            const outputFile = path.join(
                PATHS.outputDir,
                `${analysis.screenName.toLowerCase()}_auto.md`
            );
            
            fs.writeFileSync(outputFile, markdown, 'utf-8');
            
            console.log(`✅ Relatório gerado: ${outputFile}`);
            console.log(`   - Ações: ${analysis.actions.length}`);
            console.log(`   - Abas: ${analysis.tabs.length}`);
            console.log(`   - Dependências: ${analysis.dependencies.length}\n`);
        });
        
        console.log('🎉 Análise concluída!\n');
        
    } catch (error) {
        console.error('❌ Erro:', error.message);
        process.exit(1);
    }
}

main();

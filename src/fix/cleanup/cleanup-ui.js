const fs = require('fs');
const path = require('path');

const tabsDir = 'C:/Fontes/FrontM8/src/@Financeiro/pages/lancamentoentradacaixa/form/tabs';
const tabsDir2 = 'C:/Fontes/FrontM8/src/@Financeiro/pages/entrada-caixa/form/tabs'; // Just in case

[tabsDir, tabsDir2].forEach(p => {
    if (fs.existsSync(p)) {
        console.log(`Scanning ${p}...`);
        fs.readdirSync(p).forEach(tab => {
            const tabPath = path.join(p, tab);
            if (fs.statSync(tabPath).isDirectory()) {
                const indexFile = path.join(tabPath, 'index.tsx');
                if (fs.existsSync(indexFile)) {
                     // Check if it has Form.Input (broken)
                     const content = fs.readFileSync(indexFile, 'utf8');
                     if (content.includes('Form.Input') || content.includes('Form.Checkbox')) {
                         try {
                             fs.unlinkSync(indexFile);
                             console.log(`🗑️ Deleted broken UI: ${indexFile}`);
                         } catch (e) { console.error(`Failed to delete ${indexFile}`); }
                     }
                }
            }
        });
    }
});

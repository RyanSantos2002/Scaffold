const fs = require('fs');
const path = require('path');

const modelsDir = 'C:/Fontes/FrontM8/src/common/core/models/crm'; // Ajuste conforme necessário, o script usa @Financeiro/common... mas o script enhanced usa @Financeiro...
// O script enhanced usa: FRONT_SRC + common/core/models/crm (linha 116)
// FRONT_SRC = C:/Fontes/FrontM8/src
// Logo: C:/Fontes/FrontM8/src/common/core/models/crm

const targetDir = 'C:/Fontes/FrontM8/src/common/core/models/crm';
const moduleModelsDir = 'C:/Fontes/FrontM8/src/common/core/models/financeiro';

const filesToDelete = [
    'ContabilizacoesModelo.ts',
    'EntradaCaixaContabilizacoesModelo.ts',
    'AnexosModelo.ts',
    'EntradaCaixaAnexosModelo.ts',
    'CentroDeCustoModelo.ts',
    'EntradaCaixaCentroDeCustoModelo.ts'
];

[targetDir, moduleModelsDir].forEach(dir => {
    if (fs.existsSync(dir)) {
        filesToDelete.forEach(file => {
            const filePath = path.join(dir, file);
            if (fs.existsSync(filePath)) {
                try {
                    fs.unlinkSync(filePath);
                    console.log(`🗑️ Deleted: ${filePath}`);
                } catch (e) {
                    console.error(`❌ Error deleting ${filePath}: ${e.message}`);
                }
            }
        });
    } else {
        console.log(`⚠️ Directory not found: ${dir}`);
    }
});

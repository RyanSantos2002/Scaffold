const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuração
const CAPTURE_DIR = __dirname; // Rodando em html-capture
const CONFIG_PATH = path.join(CAPTURE_DIR, 'capture', '@Config', 'index.js');
const FRONT_SRC = 'C:/Fontes/FrontM8/src';

// Utils
const camelCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '');
const kebabCase = (str) => str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');
const pascalCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '');

// Carregar Config
if (!fs.existsSync(CONFIG_PATH)) {
    console.error("Config not found!");
    process.exit(1);
}
const config = require(CONFIG_PATH);
const MODULE = config.modulo;
const SCREEN = config.tela;
const METADATA_PATH = path.join(CAPTURE_DIR, '..', 'output', 'html', MODULE, config.menuPai, `${SCREEN}_metadata.json`);

// Determinar diretório de páginas (Priorizar Singular Existente)
let pageDirName = kebabCase(SCREEN);
const potentialSingular = pageDirName.replace(/s$/, ''); // Ex: contas -> conta
const singularPath = path.join(FRONT_SRC, `@${MODULE}`, 'pages', potentialSingular);

if (fs.existsSync(singularPath)) {
    console.log(`✅ Detected Singular Pages Directory: ${potentialSingular}`);
    pageDirName = potentialSingular;
}

const PAGES_DIR = path.join(FRONT_SRC, `@${MODULE}`, 'pages', pageDirName, 'form');
const SERVICES_DIR = path.join(FRONT_SRC, `@${MODULE}`, 'services', kebabCase(SCREEN)); // Check fixServices

console.log(`Fixing Screen: ${SCREEN} (${MODULE})`);

// 1. Correção de Pastas (FileSystem)
function fixFolders() {
    console.log('--- Fixing Folders ---');
    if (!fs.existsSync(path.join(PAGES_DIR, 'tabs'))) return;

    const corrections = {
        'endereos': 'enderecos',
        'oramentos': 'orcamentos',
        'historico': 'historico', 
        'contabilizaes': 'contabilizacoes'
    };

    const tabsDir = path.join(PAGES_DIR, 'tabs');
    const dirs = fs.readdirSync(tabsDir);

    dirs.forEach(dir => {
        if (corrections[dir]) {
            const oldPath = path.join(tabsDir, dir);
            const newPath = path.join(tabsDir, corrections[dir]);
            if (!fs.existsSync(newPath)) {
                fs.renameSync(oldPath, newPath);
                console.log(`✅ Renamed: ${dir} -> ${corrections[dir]}`);
            }
        }
    });
}

// 2. Injeção de TabName
function injectTabName(metadata) {
    console.log('--- Injecting TabName ---');
    const tabsDir = path.join(PAGES_DIR, 'tabs');
    if (!fs.existsSync(tabsDir)) return;
    
    // Mapeia todas as abas
    metadata.tabs.forEach((tab, index) => {
        let fileToEdit = null;
        
        const nameKebab = kebabCase(tab.name);
        // Tenta index da pasta
        let p = path.join(tabsDir, nameKebab, 'index.tsx');
        if (index === 0) p = path.join(tabsDir, 'index.tsx'); // Principal
        
        if (!fs.existsSync(p)) {
             // Tenta corrigir nome pasta se já foi arrumado
             const nameNorm = tab.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
             p = path.join(tabsDir, nameNorm, 'index.tsx');
             if (fs.existsSync(p)) fileToEdit = p;
             // Tenta 'enderecos' especificamente se falhou
             if (tab.name === 'Endereços') {
                 p = path.join(tabsDir, 'enderecos', 'index.tsx');
                 if (fs.existsSync(p)) fileToEdit = p;
             }
        } else {
            fileToEdit = p;
        }

        if (fileToEdit) {
            let content = fs.readFileSync(fileToEdit, 'utf-8');
            // Verifica se já tem
            if (!content.includes('tabName=')) {
                const tabId = camelCase(tab.name);
                let fixed = false;
                if (content.includes(`<Forms.Detail manager={manager} {...props}`)) {
                     content = content.replace(`<Forms.Detail manager={manager} {...props}`, `<Forms.Detail manager={manager} {...props} tabName={t('tabName:${tabId}')}`);
                     fixed = true;
                } else if (content.includes(`<Forms.Header {...props} manager={manager}`)) {
                     content = content.replace(`<Forms.Header {...props} manager={manager}`, `<Forms.Header {...props} manager={manager} tabName={t('tabName:${tabId}')}`);
                     fixed = true;
                } else if (content.includes(`<Forms.Simple manager={manager} {...props}`)) {
                     content = content.replace(`<Forms.Simple manager={manager} {...props}`, `<Forms.Simple manager={manager} {...props} tabName={t('tabName:${tabId}')}`);
                     fixed = true;
                }

                if (fixed) {
                    // Adicionar 'tabName' ao useTranslation se não existir
                    if (!content.includes("'tabName'")) {
                        content = content.replace(/useTranslation\(\['label'/, "useTranslation(['label', 'tabName'");
                         content = content.replace(/useTranslation\('label'\)/, "useTranslation(['label', 'tabName'])");
                    }
                    fs.writeFileSync(fileToEdit, content);
                    console.log(`✅ TabName Injected in: ${tab.name}`);
                }
            }
        }
    });
}

// 3. Reescrita Aba Anexos
function fixAnexos(metadata) {
    console.log('--- Checking Anexos Tab ---');
    const anexoTab = metadata.tabs.find(t => t.name === 'Anexos');
    if (!anexoTab) return;

    let targetFile = path.join(PAGES_DIR, 'tabs', 'anexos', 'index.tsx');
    if (!fs.existsSync(targetFile)) {
        // Tenta achar
        const dirs = fs.readdirSync(path.join(PAGES_DIR, 'tabs'));
        const dir = dirs.find(d => d.includes('anexo'));
        if (dir) targetFile = path.join(PAGES_DIR, 'tabs', dir, 'index.tsx');
        else return;
    }

    const entityName = pascalCase(SCREEN); // Ex: Contas -> Conta (need singular logic?)
    let singularEntity = entityName;
    if (singularEntity.endsWith('as')) singularEntity = singularEntity.slice(0, -1);
    if (singularEntity.endsWith('es')) singularEntity = singularEntity.slice(0, -2); 
    
    const modelName = `${singularEntity}Anexo`;
    const serviceName = `${camelCase(singularEntity)}AnexosService`;
    
    // Check if rewrite is needed (simple heuristic: if it has error prone imports)
    let content = fs.readFileSync(targetFile, 'utf-8');
    if (content.includes("@/@CRM") || content.includes("gerarImpressao")) {
         console.log('--- Rewriting Anexos Tab ---');
         
        const template = `import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import ${serviceName} from '@/@${MODULE}/services/${kebabCase(SCREEN)}/${kebabCase(singularEntity)}-anexos-service';
import { Forms } from '@/common/components/templates/Form/Principal';
import { DataGrids } from '@/common/components/UI/organisms/DataGrids/root';
import { Form } from '@/common/components/UI/organisms/FormInputs';
import type { TabsFormProps } from '@/common/components/UI/organisms/TabsForm';
import type { File } from '@/common/core/interfaces/api';
import { ${modelName} } from '@/common/core/models/${MODULE.toLowerCase()}/${kebabCase(singularEntity)}-anexo';
import { useForm } from '@/common/hooks/form/useForm';

export const ${singularEntity}AnexosTab = ({ item, ...props }: TabsFormProps) => {
  const [file, setFile] = useState<File>();

  const { t } = useTranslation(['label', 'tabName']);

  const { manager, register, watch } = useForm({
    key: ['${kebabCase(singularEntity)}-anexo'],
    formType: 'detail',
    model: ${modelName},
    service: ${serviceName},
    file,
    item,
  });

  return (
    <Forms.Detail manager={manager} {...props} tabName={t('tabName:${camelCase(anexoTab.name)}')}>
      <Form.Wrapper>
        <Form.Id {...register('id')} />

        <Form.QRCode value={watch('urlQrcodeAnexo')} />

        <Form.Input label={t('descricao')} {...register('descricao')} />

        <Form.InputFile onChange={(file) => setFile(file)} />
      </Form.Wrapper>

      <DataGrids.Secondary<${modelName}>
        columns={[
          { label: t('codigo'), field: 'id', type: 'string' },
          { label: t('descricao'), field: 'descricao', type: 'string' },
          { label: t('usuario'), field: 'atualizadoPeloUsuarioId', type: 'number' },
        ]}
      />
    </Forms.Detail>
  );
};
`;
        fs.writeFileSync(targetFile, template);
        console.log(`✅ Anexos Tab Rewritten: ${targetFile}`);
    }
}

// 4. Fix Services
function fixServices() {
    console.log('--- Fixing Services ---');
    if (!fs.existsSync(SERVICES_DIR)) return;
    
    const files = fs.readdirSync(SERVICES_DIR).filter(f => f.endsWith('.ts'));
    files.forEach(file => {
        const filePath = path.join(SERVICES_DIR, file);
        let content = fs.readFileSync(filePath, 'utf-8');
        let modified = false;

        let entityName = kebabCase(file.replace('-service.ts', '')).split('-').map(s => pascalCase(s)).join('');
        
        const routesToCheck = ['load', 'save', 'delete', 'find'];
        routesToCheck.forEach(route => {
             const regex = new RegExp(`${route}:\\s*["']\\s*["']`, 'g');
             if (regex.test(content)) {
                 if (route === 'save') {
                     content = content.replace(regex, `${route}: "${entityName}Formulario"`);
                 } else {
                     content = content.replace(regex, `${route}: "${entityName}"`);
                 }
                 modified = true;
             }
        });

        // Fix Controller Import/Usage if needed?
        // User pointed out: Module ... has no exported member
        // Meaning default export vs named export mismatch. 
        // We will TRY to ensure named export exists if file uses makeService default
        // But modifying file structure is risky.
        // Instead, fixImports handles usage side.

        if (modified) {
            fs.writeFileSync(filePath, content);
            console.log(`✅ Service Fixed: ${file}`);
        }
    });
}

// 5. Fix Imports (Generic)
function fixImports() {
    console.log('--- Fixing Imports ---');
    const tabsDir = path.join(PAGES_DIR, 'tabs');
    if (!fs.existsSync(tabsDir)) return;

    function processDir(dir) {
        const files = fs.readdirSync(dir, { withFileTypes: true });
        files.forEach(dirent => {
            const fullPath = path.join(dir, dirent.name);
            if (dirent.isDirectory()) {
                processDir(fullPath);
            } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
                let content = fs.readFileSync(fullPath, 'utf-8');
                let modified = false;

                // 1. Fix Casing @/@CRM -> @/@Crm
                const regexUpper = new RegExp(`@/@${MODULE.toUpperCase()}`, 'g');
                // Force TitleCase for Module (CRM -> Crm)
                const modulePascal = MODULE.charAt(0).toUpperCase() + MODULE.slice(1).toLowerCase();
                
                if (regexUpper.test(content)) {
                    content = content.replace(regexUpper, `@/@${modulePascal}`);
                    modified = true;
                }

                // 2. Fix Plural Services path
                const pluralScreen = kebabCase(SCREEN);
                let singularScreen = pluralScreen;
                if (singularScreen.endsWith('s')) singularScreen = singularScreen.slice(0, -1);
                
                const regexPluralService = new RegExp(`services/${pluralScreen}/`, 'g');
                if (regexPluralService.test(content) && pluralScreen !== singularScreen) {
                    content = content.replace(regexPluralService, `services/${singularScreen}/`);
                    modified = true;
                }
                
                // 3. Fix Named Import of Service if needed (Heuristic)
                // If import has { serviceName } and error says no exported member, likely default export
                // Regex: import { xxxService } from ...
                const regexNamedService = /import\s+\{\s*(\w+Service)\s*\}\s+from/g;
                if (regexNamedService.test(content)) {
                    // Replace with default import: import xxxService from
                    content = content.replace(regexNamedService, 'import $1 from');
                    modified = true;
                     console.log(`✅ Fixed Named Import to Default: ${dirent.name}`);
                }

                if (modified) {
                    fs.writeFileSync(fullPath, content);
                    console.log(`✅ Imports Fixed: ${dirent.name}`);
                }
            }
        });
    }

    processDir(tabsDir);
    // Also fix main index?
    const mainFormIndex = path.join(PAGES_DIR, 'index.tsx');
    if (fs.existsSync(mainFormIndex)) {
         let content = fs.readFileSync(mainFormIndex, 'utf-8');
         let modified = false;
         
         const regexUpper = new RegExp(`@/@${MODULE.toUpperCase()}`, 'g');
         const modulePascal = MODULE.charAt(0).toUpperCase() + MODULE.slice(1).toLowerCase();
         if (regexUpper.test(content)) {
            content = content.replace(regexUpper, `@/@${modulePascal}`);
            modified = true;
         }
         
         const pluralScreen = kebabCase(SCREEN);
         let singularScreen = pluralScreen;
         if (singularScreen.endsWith('s')) singularScreen = singularScreen.slice(0, -1);
         const regexPluralService = new RegExp(`services/${pluralScreen}/`, 'g');
         if (regexPluralService.test(content) && pluralScreen !== singularScreen) {
            content = content.replace(regexPluralService, `services/${singularScreen}/`);
            modified = true;
         }

          // Case specific: import { contaService } ...
         const regexNamedService = /import\s+\{\s*(\w+Service)\s*\}\s+from/g;
         if (regexNamedService.test(content)) {
            content = content.replace(regexNamedService, 'import $1 from');
            modified = true;
         }

         if (modified) {
             fs.writeFileSync(mainFormIndex, content);
             console.log(`✅ Main Form Index Imports Fixed`);
         }
    }

    // Also fix services imports if they refer to other services/modules
    if (fs.existsSync(SERVICES_DIR)) {
        processDir(SERVICES_DIR);
    }
    
    // Fix List Directory Imports
    const listDir = path.join(PAGES_DIR, '..', 'list');
    if (fs.existsSync(listDir)) {
        console.log(`--- Fixing Imports in List Dir: ${listDir} ---`);
        processDir(listDir);
    }
}

// 6. Ensure Models Exist
function ensureModels(metadata) {
    console.log('--- Ensuring Models Exist ---');
    const modelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', MODULE.toLowerCase());
    if (!fs.existsSync(modelsDir)) fs.mkdirSync(modelsDir, { recursive: true });

    const entityName = pascalCase(SCREEN).replace(/s$/, ''); // Conta
    
    metadata.tabs.forEach(tab => {
        if (tab.name === 'Principal') return;
        
        const tabPascal = pascalCase(tab.name); 
        const tabSingular = tabPascal.endsWith('s') ? tabPascal.slice(0, -1) : tabPascal; 
        
        const expectedModelFile = `${kebabCase(entityName)}-${kebabCase(tabSingular)}.ts`; 
        const fullPath = path.join(modelsDir, expectedModelFile);
        
        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️ Missing Model detected: ${expectedModelFile}. Creating placeholder...`);
            
            const content = `import { Mapper } from '@/common/core/models/base';
import type { AnyObject } from '@/common/core/types/any-object';

export class ${entityName}${tabSingular} extends Mapper {
  fieldMappingKeys = { 
    // Add mapping if needed, e.g. descricao: 'Descricao'
  };

  descricao?: string; // Common field fallback

  constructor(json?: AnyObject) {
    super();
    this.map(json);
  }
}
`;
            fs.writeFileSync(fullPath, content);
            console.log(`✅ Created Placeholder Model: ${expectedModelFile}`);
        }
    });
}

// Execução
if (fs.existsSync(METADATA_PATH)) {
    const output = fs.readFileSync(METADATA_PATH, 'utf-8');
    const metadata = JSON.parse(output);
    
    fixFolders();
    fixAnexos(metadata); 
    injectTabName(metadata);
    fixImports();      // NEW
    ensureModels(metadata); // NEW
    fixServices();
    
    console.log('--- Formatting Code ---');
    try {
        // Run prettier on the module folder to save time, or whole project if needed.
        // User said "passar em todas as telas ... como ctrl s"
        // Let's target the module pages dir to be faster and safe
        const targetDir = path.join(FRONT_SRC, `@${MODULE}`);
        // But formatting usually runs on cwd. Let's try running npm run format (which is prettier --write .)
        // Use CWD as FRONT_SRC root or project root? package.json is in C:/Fontes/FrontM8
        const projectRoot = 'C:/Fontes/FrontM8';
        execSync(`npx prettier --write "src/@${MODULE}/**/*.{ts,tsx}"`, { cwd: projectRoot, stdio: 'inherit' });
        console.log('✅ Formatting completed.');
    } catch (e) {
        console.error('⚠️ Formatting failed:', e.message);
    }

    
} else {
    console.error("Metadata not found.");
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Config
const FRONT_SRC = 'C:/Fontes/FrontM8/src';
const CAPTURE_DIR = __dirname;
const CONFIG_PATH = path.join(CAPTURE_DIR, 'capture', '@Config', 'index.js');

// Utils
const normalizeText = (text) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
const camelCase = (str) => normalizeText(str).replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => index === 0 ? word.toLowerCase() : word.toUpperCase()).replace(/\s+/g, '').replace(/[^a-zA-Z0-9]/g, '');
const kebabCase = (str) => str && str.match(/[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g).map(x => x.toLowerCase()).join('-');
const pascalCase = (str) => str.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '');

const STANDARD_FIELDS = ['id', 'ativo', 'usuarioCadastrouId', 'excluidoPeloUsuarioId', 'atualizadoPeloUsuarioId', 'estaExcluido', 'dataCadastro', 'dataAtualizacao'];

function fixModel() {
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error("Config not found!");
        return;
    }
    const config = require(CONFIG_PATH);
    const screenKebab = kebabCase(config.tela);
    
    // Metadata Source of Truth
    const metadataPath = path.join(CAPTURE_DIR, '..', 'output', 'html', config.modulo, config.menuPai, `${config.tela}_metadata.json`);
    if (!fs.existsSync(metadataPath)) {
        console.error(`Metadata not found at ${metadataPath}`);
        return;
    }
    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    // 1. Fix Main Model based on Metadata
    console.log("--- Fixing Main Model from Metadata ---");
    const modelsDir = path.join(FRONT_SRC, 'common', 'core', 'models', config.modulo.toLowerCase());
    let modelName = screenKebab.replace(/s$/, ''); 
    let modelPath = path.join(modelsDir, `${modelName}.ts`);
    
    if (fs.existsSync(modelPath)) {
        injectFieldsIntoModel(modelPath, metadata.fields);
    } else {
        console.warn(`Main model file not found: ${modelPath}`);
    }

    // 2. Fix UI & Models based on usage AND Metadata checks
    console.log("--- Fixing UI & Models (TSX Scans) ---");
    const pagesDir = path.join(FRONT_SRC, `@${config.modulo}`, 'pages', screenKebab, 'form'); // Try plural
    let finalPagesDir = pagesDir;
    if (!fs.existsSync(pagesDir)) {
         finalPagesDir = path.join(FRONT_SRC, `@${config.modulo}`, 'pages', screenKebab.replace(/s$/, ''), 'form'); // Try singular
    }
    
    if (fs.existsSync(finalPagesDir)) {
         // Recursive scan
         scanAndFix(finalPagesDir, modelsDir, metadata);
    } else {
        console.warn(`Form directory not found: ${pagesDir} or ${pagesDir.replace(/s$/, '')}`);
    }
}

function scanAndFix(dir, modelsDir, metadata) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    files.forEach(dirent => {
        const fullPath = path.join(dir, dirent.name);
        if (dirent.isDirectory()) {
            scanAndFix(fullPath, modelsDir, metadata);
        } else if (fullPath.endsWith('.tsx')) {
            processTsxFile(fullPath, modelsDir, metadata);
        }
    });
}

function processTsxFile(filePath, modelsDir, metadata) {
    let content = fs.readFileSync(filePath, 'utf-8');
    let modified = false;

    // 1. Identify Model
    const modelMatch = content.match(/model:\s*(\w+)/);
    if (!modelMatch) return;
    
    const modelClassName = modelMatch[1];
    
    // Find model file path
    // Heuristic: modelsDir + kebab(model).ts
    let targetModelPath = path.join(modelsDir, kebabCase(modelClassName).replace(/modelo$/, '') + '.ts');
    // Fallback: Check import path in file if reliable (omitted for speed/simplicity as heuristic usually works for these tasks)

    if (fs.existsSync(targetModelPath)) {
        // A. Fix Missing Fields in Model based on UI Usage (register)
        const usedFieldsInTsx = new Set();
        const registerRegex = /register\(['"]([\w\.]+)['"]\)/g;
        let match;
        while ((match = registerRegex.exec(content)) !== null) usedFieldsInTsx.add(match[1]);
        
        if (usedFieldsInTsx.size > 0) {
             console.log(`Checking ${modelClassName} for ${usedFieldsInTsx.size} UI fields from ${path.basename(filePath)}...`);
             injectFieldsIntoModel(targetModelPath, Array.from(usedFieldsInTsx).map(key => ({ key: key, label: key, type: 'string' })));
        }

        // B. Inject missing fields into the TSX file (simple append to Form.Wrapper)
        // This is a heuristic and might not be perfect for all TSX structures.
        // We'll check metadata fields that are not present in the TSX's register calls.
        const fieldsToInjectIntoTsx = [];
        metadata.fields.forEach(metaField => {
            let propName = camelCase(metaField.key);
            if (propName.includes('.')) return; // Skip nested for UI injection simplicity
            if (propName === 'codigo') propName = 'id'; 
            if (metaField.key === 'Id') propName = 'id';
            if (STANDARD_FIELDS.includes(propName)) return; // Skip standard fields

            // If metadata field is not used in register() calls in this TSX
            if (!usedFieldsInTsx.has(metaField.key) && !usedFieldsInTsx.has(propName)) {
                // Check if the field is already present in the TSX as a Form.Input or similar
                const fieldRegex = new RegExp(`(name|control|label)=['"]${propName}['"]`, 'i');
                if (!fieldRegex.test(content)) {
                    fieldsToInjectIntoTsx.push(metaField);
                }
            }
        });

        if (fieldsToInjectIntoTsx.length > 0) {
            console.log(`Attempting to inject ${fieldsToInjectIntoTsx.length} fields into ${path.basename(filePath)} UI...`);
            const formWrapperEndIndex = content.lastIndexOf('</Form.Wrapper>');
            if (formWrapperEndIndex !== -1) {
                const insertionPoint = formWrapperEndIndex;
                let fieldsToAppend = '';
                fieldsToInjectIntoTsx.forEach(field => {
                    let propName = camelCase(field.key);
                    if (propName === 'codigo') propName = 'id'; 
                    if (field.key === 'Id') propName = 'id';
                    let label = field.label || propName;
                    let type = 'text';
                    if (field.type === 'number' || propName.endsWith('Id')) type = 'number';
                    if (field.type === 'boolean' || field.type === 'checkbox') type = 'checkbox';
                    if (field.type === 'date') type = 'date';

                    // Simple Form.Input for now
                    if (type === 'checkbox') {
                        fieldsToAppend += `\n          <Form.Checkbox name="${propName}" label="${label}" />`;
                    } else if (type === 'date') {
                        fieldsToAppend += `\n          <Form.DatePicker name="${propName}" label="${label}" />`;
                    } else {
                        fieldsToAppend += `\n          <Form.Input name="${propName}" label="${label}" type="${type}" />`;
                    }
                });
                
                content = content.substring(0, insertionPoint) + fieldsToAppend + '\n        ' + content.substring(insertionPoint);
                modified = true;
                console.log(`✅ Injected ${fieldsToInjectIntoTsx.length} UI elements into ${path.basename(filePath)}`);
            } else {
                console.warn(`⚠️ Could not find </Form.Wrapper> in ${path.basename(filePath)} to inject UI fields.`);
            }
        }
    } else {
        console.warn(`Model file not found for ${modelClassName}: ${targetModelPath}`);
    }

    if (modified) {
        fs.writeFileSync(filePath, content);
    }
}

function injectFieldsIntoModel(modelPath, fields) {
    let content = fs.readFileSync(modelPath, 'utf-8');
    let injectedCount = 0;
    const insertions = [];

    fields.forEach(field => {
        let propName = camelCase(field.key); 
        // Handle nested paths?
        if (propName.includes('.')) return; 

        if (propName === 'codigo') propName = 'id'; 
        if (field.key === 'Id') propName = 'id';

        // RULE: Ignore Standard Fields
        if (STANDARD_FIELDS.includes(propName)) return;

        // Check existence
        if (!content.includes(`${propName}?`) && 
            !content.includes(`${propName}:`) && 
            !content.includes(`${propName} =`)) {
            
            let propStr = '';
            let type = 'string';
            if (field.type === 'number' || propName.endsWith('Id')) type = 'number';
            if (field.type === 'boolean' || field.type === 'checkbox') type = 'boolean';
            if (field.type === 'date') type = 'Date';
            
            propStr += `  ${propName}?: ${type};\n`;
            insertions.push(propStr);
            injectedCount++;
        }
    });
    
    if (insertions.length > 0) {
        const lines = content.split('\n');
        let insertIndex = lines.findIndex(l => l.includes('constructor'));
        if (insertIndex === -1) {
            // Find the last '}' of the class definition, assuming it's the second to last line
            insertIndex = lines.length - 2; 
            // More robust: find the last line that starts with '}' and is not the very last line of the file
            for (let i = lines.length - 1; i >= 0; i--) {
                if (lines[i].trim() === '}' && i > 0) {
                    insertIndex = i;
                    break;
                }
            }
        }
        
        const newLines = [
            ...lines.slice(0, insertIndex),
            ...insertions,
            ...lines.slice(insertIndex)
        ];
        
        fs.writeFileSync(modelPath, newLines.join('\n'));
        console.log(`✅ Injected ${injectedCount} fields into ${path.basename(modelPath)}`);
    }
}

fixModel();

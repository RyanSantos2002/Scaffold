---
description: Corrigir automaticamente problemas de scaffolding (pastas, tabName, Anexos)
---

1. Executar Script de Correção
   - Command: `node fix-scaffold.js`
   - Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

// turbo 2. Injetar Campos no Model

- Command: `node fix-model.js`
- Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

// turbo 3. Re-validar com Auditoria

- Command: `node audit-scaffold-deep.js`
- Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

4. Validar com Build final

- Command: `npm run build`
- Cwd: `C:/Fontes/FrontM8`

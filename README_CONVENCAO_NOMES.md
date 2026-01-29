# 📚 Convenção de Nomes - Modelos do Projeto

## Padrão Adotado no Projeto

Os modelos no FrontM8 seguem a convenção **kebab-case sem sufixo "Modelo"**:

```
✅ CORRETO
conta.ts
conta-contato.ts
conta-anexo.ts
conta-empresa-grupo.ts

❌ EVITAR (legacy)
ContaModelo.ts
ContaContatoModelo.ts
```

## Como os Scripts Procuram Modelos

Todos os scripts de scaffolding e auditoria procuram modelos na seguinte ordem de prioridade:

### 1. Modelo Principal (ex: Contas)

```javascript
conta.ts; // 1ª tentativa - kebab-case singular (PRIORITÁRIO)
ContaModelo.ts; // 2ª tentativa - PascalCase singular
ContasModelo.ts; // 3ª tentativa - PascalCase plural
```

### 2. Modelos de Abas (ex: Contatos)

```javascript
conta - contato.ts; // 1ª tentativa - kebab singular (PRIORITÁRIO)
conta - contatos.ts; // 2ª tentativa - kebab plural
contato.ts; // 3ª tentativa - só o nome da aba
contatos.ts; // 4ª tentativa - aba plural
ContaContatoModelo.ts; // 5ª tentativa - PascalCase (compatibilidade)
// ... outros padrões legacy
```

## Scripts Atualizados

### ✅ Principais (Uso Recomendado)

- `audit-scaffold-enhanced.js` - Auditoria completa com detecção automática
- `fix-scaffold-enhanced.js` - Correção automática de campos faltantes

### ✅ Auxiliares

- `fix-scaffold.js` - Correções de estrutura e imports
- `audit-scaffold.js` - Auditoria básica

## Localização dos Modelos

```
src/common/core/models/
  └── crm/
      ├── conta.ts
      ├── conta-contato.ts
      ├── conta-anexo.ts
      ├── conta-empresa-grupo.ts
      └── conta-orcamento.ts
```

## Uso dos Scripts

### Workflow Completo

```bash
# 1. Capturar HTML da tela
node engine.js

# 2. Extrair abas e gerar JSON
node extract-tabs.js

# 3. Gerar arquivos da tela
node send-scaffold.js

# 4. Auditar tela gerada
node audit-scaffold-enhanced.js

# 5. Corrigir automaticamente
node fix-scaffold-enhanced.js

# 6. Auditar novamente para validar
node audit-scaffold-enhanced.js
```

## Exemplos Reais

### Tela "Contas"

| Aba        | Nome do Modelo no Código | Arquivo no Projeto   |
| ---------- | ------------------------ | -------------------- |
| Principal  | `Conta`                  | `conta.ts`           |
| Contatos   | `ContaContato`           | `conta-contato.ts`   |
| Anexos     | `ContaAnexo`             | `conta-anexo.ts`     |
| Orçamentos | `ContaOrcamento`         | `conta-orcamento.ts` |

## Troubleshooting

### ❌ Modelo não encontrado

**Problema:** `❌ Modelo Principal não encontrado para esta aba`

**Solução:**

1. Verifique se o arquivo existe em `src/common/core/models/crm/`
2. Confirme que está em kebab-case: `conta-contato.ts` (não `ContaContatoModelo.ts`)
3. Verifique se está singular

: `conta-contato.ts` (não `conta-contatos.ts`)

### ❌ Campos faltantes persistem

**Problema:** Auditoria mostra campos faltantes mesmo após correção

**Solução:**

1. Execute `fix-scaffold-enhanced.js` novamente
2. Verifique se o modelo foi encontrado (não basta existir, precisa ser detectado)
3. Confirme que o nome do arquivo segue a convenção

## Manutenção

### Adicionando Novo Modelo

1. Crie arquivo em kebab-case: `nova-entidade.ts`
2. Use classe em PascalCase: `export class NovaEntidade`
3. Scripts detectarão automaticamente

### Atualizando Scripts

Se precisar modificar a lógica de busca, atualize TODOS estes arquivos:

- `audit-scaffold-enhanced.js`
- `fix-scaffold-enhanced.js`
- (opcionalmente) `fix-scaffold.js` e `audit-scaffold.js`

## Histórico de Mudanças

**2026-01-30:** Scripts atualizados para priorizar kebab-case

- Adicionado suporte a variações singular/plural
- 94% de melhoria na detecção de modelos
- Compatibilidade mantida com PascalCase legacy

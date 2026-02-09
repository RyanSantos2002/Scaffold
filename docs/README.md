# HTML Capture - Sistema de Scaffolding M8

Sistema automatizado para captura de HTML do sistema legado M8 e geração de código FrontM8 moderno.

## 📁 Estrutura do Projeto

```
html-capture/
├── src/                    # Código-fonte
│   ├── capture/           # Captura de HTML
│   ├── processing/        # Processamento de dados
│   ├── scaffolding/       # Geração de scaffolding
│   ├── audit/             # Auditoria de código
│   ├── fix/               # Correção automática
│   └── utils/             # Utilitários
├── docs/                  # Documentação
├── output/                # Arquivos gerados
│   ├── html/             # HTMLs capturados
│   ├── json/             # JSONs processados
│   └── audits/           # Relatórios de auditoria
└── temp/                  # Arquivos temporários
```

## 🚀 Workflows Principais

### `/gerar-json` - Captura e Geração de JSON

Captura o HTML da tela atual do sistema legado e gera o JSON correspondente.

**Scripts utilizados:**

- `src/capture/browser-engine.js` - Motor de captura com Playwright
- `src/processing/extract-tabs.js` - Extração de abas e geração de JSON

### `/gerar-tela` - Geração de Código FrontM8

Gera o código FrontM8 completo a partir do JSON extraído.

**Scripts utilizados:**

- `src/scaffolding/send-to-scaffold.js` - Envia JSON para servidor de scaffolding

### `/auditar-tela` - Auditoria Automática

Audita automaticamente a tela gerada comparando com os HTMLs capturados.

**Scripts utilizados:**

- `src/audit/audit-enhanced.js` - Auditoria aprimorada com metadados profundos

### `/fix-scaffold-enhanced` - Correção Automática

Corrige automaticamente problemas identificados no scaffolding.

**Scripts utilizados:**

- `src/fix/fix-scaffold-enhanced.js` - Correção aprimorada de scaffolding

### `/capturar-acoes` - Captura de Ações e Regras

Captura e documenta ações e regras de negócio do HTML.

**Scripts utilizados:**

- `src/processing/analyze-actions.js` - Análise de ações e regras

## 📂 Organização dos Scripts

### 📁 src/capture/ - Captura HTML

- `browser-engine.js` - Motor de captura com Playwright
- `login-handler.js` - Gerenciador de login no sistema legado

### 📁 src/processing/ - Processamento

- `extract-tabs.js` - Extrai abas do HTML capturado
- `extract-metadata.js` - Extrai metadados do HTML
- `parse-html.js` - Parser direto de HTML
- `analyze-actions.js` - Analisa ações e regras de negócio

### 📁 src/scaffolding/ - Scaffolding

- `generate-json.js` - Gera JSON para scaffolding
- `send-to-scaffold.js` - Envia JSON para servidor de scaffolding

### 📁 src/audit/ - Auditoria

- `audit-basic.js` - Auditoria básica
- `audit-deep.js` - Auditoria profunda
- `audit-enhanced.js` - Auditoria aprimorada com metadados

### 📁 src/fix/ - Correção

- `fix-scaffold.js` - Correção básica de scaffolding
- `fix-scaffold-enhanced.js` - Correção aprimorada
- `fix-model.js` - Correção de models
- `audit-and-fix.js` - Auditoria + correção combinada
- `cleanup/`
  - `cleanup-models.js` - Limpeza de models
  - `cleanup-ui.js` - Limpeza de componentes UI

### 📁 src/utils/ - Utilitários

- `build-and-fix.js` - Script de build + correção
- `check-fields.js` - Verificação de campos

## 📚 Documentação

- `docs/README.md` - Este arquivo
- `docs/manual-projeto.md` - **Manual Completo do Projeto**
- `docs/guia-desenvolvedor.md` - **Guia de Setup e Uso**
- `docs/workflows.md` - **Catálogo de Workflows**
- `docs/scripts-automacao.md` - **Documentação Técnica dos Scripts**
- `docs/troubleshooting.md` - **Resolução de Problemas**
- `docs/padroes.md` - Padrões e convenções do projeto
- `docs/regras-negocio/` - Regras de negócio documentadas por tela

## 🛠️ Uso

### Pré-requisitos

```bash
npm install
```

### Executar Workflows

Use os comandos slash no Antigravity:

- `/gerar-json` - Capturar HTML e gerar JSON
- `/gerar-tela` - Gerar código FrontM8
- `/auditar-tela` - Auditar tela gerada
- `/fix-scaffold-enhanced` - Corrigir problemas
- `/capturar-acoes` - Capturar ações e regras

### Executar Scripts Individualmente

```bash
# Captura HTML
node src/capture/browser-engine.js

# Processar e gerar JSON
node src/processing/extract-tabs.js

# Auditar
node src/audit/audit-enhanced.js

# Corrigir
node src/fix/fix-scaffold-enhanced.js
```

## 🔧 Configuração

- `.env` - Variáveis de ambiente (credenciais, URLs)
- `session.json` - Sessão do Playwright (gerado automaticamente)
- `.gitignore` - Arquivos ignorados pelo Git

## 📝 Convenções

- **Nomes de arquivos:** kebab-case (ex: `browser-engine.js`)
- **Pastas:** kebab-case (ex: `src/capture/`)
- **Documentação:** Markdown em `docs/`
- **Output:** Separado por tipo em `output/`

## 🤝 Contribuindo

1. Mantenha a estrutura de pastas organizada
2. Use nomes descritivos para scripts
3. Documente regras de negócio em `docs/regras-negocio/`
4. Atualize este README ao adicionar novos scripts

## 📄 Licença

Projeto interno M8 ERP.

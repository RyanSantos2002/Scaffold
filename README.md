# HTML Capture - Sistema de Captura Automatizada

Sistema automatizado para captura de estruturas HTML de aplicações ERP e geração de metadados JSON.

## 🚀 Funcionalidades

- **engine.js**: Automatiza navegação no ERP usando Playwright e captura estruturas HTML de listagens e formulários
- **extract-tabs.js**: Analisa HTML capturado e gera metadados JSON com informações das abas

## 📦 Requisitos

- Node.js 18+
- Playwright

## 🔧 Instalação

```bash
npm install
```

## 📖 Uso

### 1. Configurar Captura

Edite `capture/@Config/index.js`:

```javascript
module.exports = {
  modulo: "CRM",
  menuPai: "Movimento",
  tela: "Contas",
  idBotaoTela: "Contas",
  textoLinkListagem: "Lista Cadastro de Contas",
  colunaOrdenacao: "Código",
  keywordUrl: "contas",
};
```

### 2. Executar Captura

```bash
node engine.js
```

Captura HTML da listagem e formulário, salvando em `../output/`:

- `Lista/` - HTML da listagem
- `Form/` - HTML do formulário

### 3. Gerar JSON de Metadados

```bash
node extract-tabs.js
```

Gera JSON com informações das abas em `../output/json/{tela}/`.

## 📁 Estrutura de Saída

```
output/
├── Lista/
│   └── contas_listagem.html
├── Form/
│   └── cadastro_id_9.html
└── json/
    └── Contas/
        └── Contas.json
```

## 🔐 Autenticação

Crie um arquivo `session.json` com as credenciais de sessão do navegador.

## 📝 Notas

- `session.json` não é versionado (credenciais sensíveis)
- Arquivos de output são temporários e não commitados
- Use o modo não-headless para debug visual

## 📄 Licença

Proprietary - Uso interno

# Guia do Desenvolvedor - M8Arctec

Este guia contém as instruções técnicas para configurar o ambiente e operar as ferramentas de automação do projeto M8Arctec.

## 1. Setup do Ambiente

### Pré-requisitos

- **Node.js** (v18 ou superior)
- **NPM**
- **Git**
- **Acesso ao Repositório do Legado** (para Playwright acessar)
- **Antigravity** (configurado e rodando)

### Instalação

1.  Clone o repositório de automação:

    ```bash
    git clone [url-do-repo]/html-capture.git
    cd html-capture
    ```

2.  Instale as dependências:

    ```bash
    npm install
    ```

3.  Configure as variáveis de ambiente:
    Crie um arquivo `.env` na raiz com:
    ```env
    LEGACY_SYSTEM_URL=http://localhost:port
    LEGACY_USER=admin
    LEGACY_PASSWORD=senha
    SCAFFOLD_API_URL=http://localhost:3000
    ```

---

## 2. Operação: Como Converter uma Tela

A conversão é feita através de "Workflows" (comandos que começam com `/` no Antigravity).

### Fluxo Padrão

1.  **Gerar JSON da Tela:**
    - No Antigravity, digite: `/gerar-json`
    - O sistema abrirá o browser, capturará a tela e gerará o JSON.

2.  **Gerar Código:**
    - Digite: `/gerar-tela`
    - O código React será criado na pasta `src` do projeto principal.

3.  **Auditar e Corrigir:**
    - Digite: `/fix-scaffold-enhanced`
    - Este comando é **CRÍTICO**. Ele roda o build, verifica erros e aplica correções automáticas. Pode ser necessário rodar mais de uma vez.

4.  **Documentar e Finalizar:**
    - Digite: `/capturar-acoes` para extrair regras de negócio.
    - Implemente as regras manuais necessárias.
    - Digite: `/gerar-documentacao` para atualizar os docs.

---

## 3. Estrutura de Scripts (Deep Dive)

Para manutenção e evolução da ferramenta, entenda onde está cada lógica:

### Captura (`src/capture/`)

- `browser-engine.js`: Script principal do Playwright. Controla o browser.
- `login-handler.js`: Lógica de autenticação. Se o login mudar, altere aqui.

### Processamento (`src/processing/`)

- `extract-tabs.js`: O "cérebro" da estruturação. Analisa o HTML bruto e decide o que é aba, o que é campo, o que é grid.
- `clean-html.js`: Remove ruídos (scripts, estilos) antes do processamento.

### Auditoria e Correção (`src/fix/` e `src/audit/`)

- `audit-scaffold-enhanced.js`: Compara JSON vs Código Gerado. Loga discrepâncias.
- `fix-scaffold-enhanced.js`: Lê o log da auditoria e edita os arquivos `.ts` e `.tsx` para adicionar campos faltantes ou corrigir imports.

---

## 4. Troubleshooting (Resolução de Problemas)

### Erro: "Element not found" no Playwright

- **Causa:** O sistema legado demorou para carregar ou o seletor mudou.
- **Solução:** Aumente o timeout no `execution-config.json` ou atualize o seletor no `browser-engine.js`.

### Erro: Build falha após scaffolding

- **Causa:** Imports circulares ou tipos não definidos.
- **Solução:** Rode `/fix-scaffold-enhanced`. Se persistir, verifique se o Model foi criado corretamente em `common/core/models`.

### Erro: Campos duplicados no Grid

- **Causa:** O JSON continha o mesmo campo mapeado duas vezes (ex: tabela e hidden).
- **Solução:** O script `fix-scaffold-enhanced.js` tem uma rotina de `dedupe`. Rode-o novamente.

---

## 5. Boas Práticas de Desenvolvimento

- **Nunca edite arquivos gerados manualmente antes da auditoria.** Deixe o script corrigir o grosso primeiro.
- **Mantenha o `padroes.md` atualizado.** Se mudar a forma como escrevemos componentes React, atualize a documentação e os templates do scaffolding.
- **Versionamento.** Commite os JSONs gerados (`output/json`) para ter histórico do estado da tela legado naquele momento.

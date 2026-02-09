# Documentação Técnica dos Scripts de Automação

Este documento detalha o funcionamento interno dos principais scripts em `src/`.

## 1. `src/fix/fix-scaffold-enhanced.js`

Este é o script mais complexo e importante do sistema.

### Funcionalidades

- **Leitura de Log:** Consome `generated-files.json` para saber exatamente quais arquivos foram criados pelo scaffolding, evitando adivinhar caminhos.
- **Injeção de Campos:** Lê o Model (`.ts`) e a Interface (`.tsx`), compara com o JSON original, e injeta campos que faltaram.
- **Correção de Imports:** Verifica se `service` e `model` estão importados corretamente. Corrige caminhos relativos (`../../`).
- **Limpeza de Grid:** Detecta e remove colunas duplicadas no componente de Grid.

### Como Estender

Para adicionar uma nova regra de correção (ex: adicionar um novo Decorator em todos os models), edite a função `processModelFile` dentro deste script.

---

## 2. `src/audit/audit-scaffold-enhanced.js`

Script de diagnóstico. Não altera arquivos, apenas reporta.

### Funcionalidades

- Verifica existência física dos arquivos.
- Valida sintaxe básica (se o arquivo não está vazio).
- Compara a lista de campos do JSON com as propriedades da classe do Model.

### Saída

Gera um relatório no console e (opcionalmente) um arquivo de log em `output/audits/`.

---

## 3. `src/scaffolding/send-to-scaffold.js`

A ponte entre a captura e a geração.

### Funcionalidades

- Lê o JSON processado.
- Faz um POST para a API do Scaffolder (ferramenta externa/local).
- Recebe a lista de arquivos criados e salva em `generated-files.json`.

---

## 4. `src/capture/browser-engine.js` (Playwright)

O "olho" do sistema.

### Configuração Importante

O seletor de espera (wait selector) é crucial. Atualmente configurado para esperar pelo elemento `#principal` ou `form`. Se o sistema legado mudar o layout base, este script precisará de ajuste.

### Autenticação

Utiliza o `login-handler.js` para gerenciar sessão. Salva o estado em `session.json` para não precisar relogar a cada execução (speedup).

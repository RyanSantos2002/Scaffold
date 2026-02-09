# Manual do Projeto M8Arctec

## 1. Visão Geral

**Nome do projeto:** M8Arctec
**Contexto:** Migração de Sistema Legado (C#) para React
**Arquitetura:** Orquestração Inteligente (Antigravity + Scripts Customizados)

O **M8Arctec** é um sistema de automação projetado para converter telas e funcionalidades do ERP M8 legado para uma nova interface web moderna em **React**.

Diferente de conversores estáticos tradicionais, o M8Arctec utiliza uma abordagem híbrida que combina:

1.  **Captura Visual (Playwright):** Extrai a "verdade" da tela como o usuário a vê.
2.  **Scaffolding Estrutural:** Gera rapidamente a base do código (Models, Services, Forms, Grids).
3.  **Auditoria e Correção Inteligente:** Scripts que analisam o código gerado, detectam inconsistências e aplicam correções automáticas.
4.  **Captura de Comportamento:** Extração e documentação de regras de negócio e ações do HTML legado.

---

## 2. Arquitetura do Processo

O processo de migração é linear e sequencial, garantindo que cada etapa construa sobre a anterior.

### Fluxo de Dados

```mermaid
graph TD
    A[Sistema Legado] -->|Playwright| B(HTML Capturado)
    B -->|Extract Tabs| C{JSON Estruturado}
    C -->|Gen Code| D[Código FrontM8 (React)]
    D -->|Audit Script| E{Auditoria}
    E -->|Erro| F[Fix Script]
    F -->|Correção| D
    E -->|OK| G[Tela Validada]
    G -->|Capture Actions| H[Ações e Regras]
    H -->|Implementação| I[Tela Final]
```

---

## 3. Passo a Passo Detalhado

O processo de conversão é dividido em 7 passos principais de orquestração.

### Passo 1: Captura (`/gerar-json`)

- **O que faz:** Abre o navegador, loga no sistema legado, navega até a tela desejada e salva o HTML completo.
- **Ferramenta:** `engine.js` (Playwright).
- **Saída:** Arquivo `.html` na pasta `output/html`.

### Passo 2: Processamento (`/gerar-json`)

- **O que faz:** Limpa o HTML (remove scripts, estilos inline), identifica abas e campos, e converte tudo para um JSON padronizado.
- **Ferramenta:** `extract-tabs.js`.
- **Saída:** Arquivo `.json` em `output/json`.

### Passo 3: Geração de Código (`/gerar-tela`)

- **O que faz:** Envia o JSON para o gerador de scaffolding, que cria os arquivos físicos no projeto React.
- **Ferramenta:** `send-to-scaffold.js`.
- **Saída:** Arquivos `.ts` e `.tsx` em `src/@CRM/pages/...`, `common/core/models/...`, etc.

### Passo 4: Auditoria e Correção (`/fix-scaffold-enhanced`)

- **O que faz:**
  1.  Tenta compilar o projeto.
  2.  Analisa erros de build (imports errados, models incompletos).
  3.  Verifica se todos os campos do JSON estão no Model e na Tela.
  4.  Aplica correções automáticas (adiciona campos, corrige imports).
- **Ferramentas:** `audit-scaffold-enhanced.js`, `fix-scaffold-enhanced.js`.
- **Saída:** Código compilável e correto.

### Passo 5: Captura de Ações (`/capturar-acoes`)

- **O que faz:** Relê o HTML original buscando botões, links e scripts que indiquem regras de negócio (ex: "botão Salvar chama endpoint X", "campo Y é obrigatório se Z for preenchido").
- **Ferramenta:** `analyze-actions.js`.
- **Saída:** Relatório Markdown em `docs/regras-negocio/`.

### Passo 6: Implementação de Regras (`/implementar-acoes`)

- **O que faz:** O desenvolvedor (ou Agente) implementa manualmente a lógica complexa identificada no passo anterior.
- **Ação:** Edição dos arquivos `service.ts` e `index.tsx` da tela.

### Passo 7: Documentação (`/gerar-documentacao`)

- **O que faz:** Consolida todas as informações sobre a tela convertida em um documento final.
- **Saída:** Atualização do `docs/README.md` e logs de migração.

---

## 4. Estrutura de Diretórios Importante

- `html-capture/`
  - `src/` - Scripts de automação (Node.js).
  - `output/` - Arquivos gerados (não versionar).
  - `docs/` - Documentação do projeto.
  - `.agent/workflows/` - Definições dos workflows do Antigravity.

---

## 5. Próximos Passos (Roadmap)

- [ ] Aprimorar detecção de tipos complexos no passo 2.
- [ ] Automatizar mais casos de borda no passo 4.
- [ ] Criar testes unitários automáticos para as telas geradas.

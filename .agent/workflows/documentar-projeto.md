---
description: Gera documentação completa do projeto incluindo telas, ações, regras de negócio e histórico
---

# Workflow de Documentação Completa

Este workflow gera uma documentação abrangente de tudo que foi construído no projeto.

## Etapas

### 1. Analisar Estrutura do Projeto

Primeiro, analise a estrutura atual para identificar:

- Telas geradas (verificar `C:/Fontes/FrontM8/src/@CRM/pages/` e outros módulos)
- JSONs processados em `output/json/`
- Regras de negócio documentadas em `docs/regras-negocio/`
- Logs de geração em `generated-files.json` do Projeto-Scaffolding

### 2. Coletar Informações de Telas Geradas

Para cada tela identificada:

- Nome da tela
- Módulo (CRM, Financeiro, etc)
- Data de geração
- Arquivos gerados (models, services, UI components)
- JSON fonte

### 3. Documentar Ações Implementadas

Para cada tela, listar:

- Ações do formulário (Bloquear, Desbloquear, etc)
- Endpoints mapeados
- Regras de validação
- Dependências entre campos

### 4. Consolidar Regras de Negócio

Compilar todas as regras de negócio de:

- Arquivos em `docs/regras-negocio/`
- Comentários nos HTMLs capturados
- Análises de ações realizadas

### 5. Gerar Relatório Consolidado

Criar documento markdown em `docs/projeto-documentacao.md` contendo:

```markdown
# Documentação do Projeto M8 Scaffolding

## Resumo Executivo

- Total de telas geradas
- Módulos cobertos
- Data de início/fim
- Estatísticas gerais

## Telas Geradas

### [Nome da Tela]

- **Módulo:** CRM/Financeiro/etc
- **Data:** YYYY-MM-DD
- **Arquivos:**
  - Model: caminho/para/model.ts
  - Service: caminho/para/service.ts
  - Form: caminho/para/form/index.tsx
  - Grid: caminho/para/grid/index.tsx

#### Ações Implementadas

- Ação 1: Descrição, endpoint
- Ação 2: Descrição, endpoint

#### Regras de Negócio

- Regra 1
- Regra 2

#### Campos Principais

| Campo | Tipo | Obrigatório | Validação |
| ----- | ---- | ----------- | --------- |
| ...   | ...  | ...         | ...       |

---

## Regras de Negócio Gerais

### Por Módulo

...

## Padrões Utilizados

### Nomenclatura

...

### Estrutura de Código

...

## Histórico de Alterações

### [Data] - [Tela]

- O que foi feito
- Problemas encontrados
- Soluções aplicadas

## Métricas

- Total de models gerados: X
- Total de services gerados: X
- Total de componentes UI: X
- Linhas de código geradas: ~X
```

### 6. Atualizar Índice de Documentação

Criar/atualizar `docs/README.md` com links para:

- Documentação principal do projeto
- Regras de negócio por tela
- Padrões e convenções
- Guias de uso

## Comandos

Este workflow é principalmente manual, mas você pode usar os seguintes scripts auxiliares:

```bash
# Listar todos os JSONs processados
Get-ChildItem -Path "output/json" -Filter "*.json" -Recurse

# Verificar generated-files.json do scaffolding
Get-Content "../Projeto-Scaffolding/generated-files.json" | ConvertFrom-Json

# Listar regras de negócio documentadas
Get-ChildItem -Path "docs/regras-negocio" -Filter "*.md"
```

## Saída Esperada

- `docs/projeto-documentacao.md` - Documentação consolidada
- `docs/README.md` - Índice atualizado
- `docs/metricas.md` - Métricas do projeto (opcional)
- `docs/historico.md` - Histórico de alterações (opcional)

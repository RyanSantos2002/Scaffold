# Relatório de Auditoria Detalhada: Caixa
**Data:** 06/02/2026, 15:32:51
**Fonte:** HTML Capturado

## 1. Verificação de Modelos

### Aba: Entrada Caixa
✅ **Modelo Analisado:** `lancamento-entrada-caixa.ts (Via Log)`

**❌ Campos Faltantes no Modelo:**
- [ ] `Id`
- [ ] `EmpresaId`
- [ ] `PessoaLancamentoId`
- [ ] `DataLancamento`
- [ ] `Competencia`
- [ ] `ValorLancamento`
- [ ] `OperacaoFinanceiraId`
- [ ] `ContaCaixaBancoOrigemId`
- [ ] `ContaCaixaBancoDestinoId`
- [ ] `HistoricoContabilId`
- [ ] `EspecieId`
- [ ] `ProjetoExecucaoId`
- [ ] `ProjetoExecucaoTarefaItemId`
- [ ] `CentroCustoId`
- [ ] `ProcessoImportacaoId`
- [ ] `ImovelRuralId`
- [ ] `Observacao`

**⚠️ Discrepâncias de Regras:**
- ⚠️ Campo **Documento** (Documento) tem MaxLength(100), não verificado no Model.
- ⚠️ Campo **Complemento** (Complemento) tem MaxLength(500), não verificado no Model.

### Aba: Centro de Custo
✅ **Modelo Analisado:** `centro-custos-lancamento-financeiro.ts (Via Log)`

**❌ Campos Faltantes no Modelo:**
- [ ] `Id`
- [ ] `CentroCustoId`
- [ ] `OperacaoFinanceiraId`
- [ ] `Percentual`
- [ ] `Valor`
- [ ] `Complemento`

### Aba: Contabilizações
ℹ️ Aba sem campos de formulário (possivelmente apenas Grid ou vazia).

### Aba: Anexos
✅ **Modelo Analisado:** `lancamento-anexo.ts (Via Log)`
- ✅ Todos os 2 campos presentes no modelo.

**⚠️ Discrepâncias de Regras:**
- ⚠️ Campo **Descrição** (Descricao) tem MaxLength(100), não verificado no Model.

### Aba: Entrada Caixa
✅ **Arquivo:** `@financeiro\pages\lancamentoentradacaixa\form\tabs\index.tsx`
✅ Aba utiliza `Forms.Header` corretamente.

**❌ Campos Faltantes na Tela (TSX):**
- [ ] `Id` (Label: Código)
- [ ] `EmpresaId` (Label: Estabelecimento)
- [ ] `PessoaLancamentoId` (Label: Pessoa)
- [ ] `DataLancamento` (Label: Lançamento)
- [ ] `Competencia` (Label: Competência)
- [ ] `ValorLancamento` (Label: Valor)
- [ ] `HistoricoContabilId` (Label: Histórico Contábil)
- [ ] `TipoDocumento` (Label: Tipo Documento)
- [ ] `Observacao` (Label: Observação)

### Aba: Centro de Custo
✅ **Arquivo:** `@financeiro\pages\lancamentoentradacaixa\form\tabs\index.tsx`
✅ Aba utiliza `Forms.Header` corretamente.

**❌ Campos Faltantes na Tela (TSX):**
- [ ] `Id` (Label: Código)
- [ ] `Percentual` (Label: % Percentual)
- [ ] `Valor` (Label: Valor)
- ❌ **Grid esperada mas NÃO detectada no código.**

### Aba: Contabilizações
✅ **Arquivo:** `@financeiro\pages\lancamentoentradacaixa\form\tabs\contabilizacoes\index.tsx`
❌ **ERRO: Aba não utiliza `Forms.Header`.**

### Aba: Anexos
✅ **Arquivo:** `@financeiro\pages\lancamentoentradacaixa\form\tabs\anexos\index.tsx`
❌ **ERRO: Aba não utiliza `Forms.Header`.**
- ✅ Todos os 2 campos encontrados na UI.

## 3. Verificação de Serviços
✅ **Serviços Encontrados (Via Log):**
- ✅ `lancamentoentradacaixa-anexos-service.ts`
- ❌ `lancamentoentradacaixa-contabilizacoes-service.ts`: BaseService genérico, Placeholder AssistenciaTecnica
- ✅ `lancamentoentradacaixa-service.ts`

## 4. Verificação de Grid (Listagem)
✅ **Colunas detectadas no HTML original:** 15
✅ **Componente Grid encontrado:** `common\core\grids\financeiro\lancamento-entrada-caixa-grid.tsx`

**❌ Colunas Faltantes na Grid React:**
- [ ] `Id` - Label: Código
- [ ] `EmpresaNome` - Label: Estabelecimento
- [ ] `PessoaLancamentoNome` - Label: Pessoa
- [ ] `Documento` - Label: Documento
- [ ] `EspecieNome` - Label: Espécie
- [ ] `DataLancamento` - Label: Lançamento
- [ ] `ValorLancamento` - Label: Valor
- [ ] `OperacaoFinanceiraNome` - Label: Plano de Contas Financeiro
- [ ] `Observacao` - Label: Observação
- [ ] `ImovelRuralNome` - Label: Imóvel Rural Nome
- [ ] `ExcluidoPeloUsuarioId` - Label: Usuário
# Troubleshooting - Erros Comuns e Soluções

## Build Errors

### 1. `Cannot find module '@/@Crm/...'`

**Causa:** O alias `@` não está resolvendo corretamente ou o arquivo não existe.
**Solução:**

1. Verifique se o arquivo existe fisicamente.
2. Verifique o `tsconfig.json` para garantir que os `paths` estão configurados.
3. Rode `/fix-scaffold-enhanced`, ele costuma corrigir caminhos de import.

### 2. `Property 'X' has no initializer and is not definitely assigned in the constructor.`

**Causa:** Model gerado sem inicialização padrão ou sem `!`.
**Solução:**

- O script `fix-scaffold-enhanced` deve adicionar `?` ou inicializadores.
- Manualmente: Adicione `?` (opcional) ou inicialize no construtor.

### 3. `Duplicate identifier 'X'.`

**Causa:** O mesmo campo foi declarado duas vezes no Model ou na Interface.
**Solução:**

- Verifique o JSON de origem, pode ter campos com nomes iguais (ex: `codigo` e `Codigo`).
- O script de correção tem uma lógica de _dedupe_, tente rodá-lo novamente.

## Runtime Errors

### 1. Grid não carrega dados

**Causa:** O nome do campo no Grid (`field`) não bate com a propriedade no JSON que volta da API.
**Solução:**

- Inspecione a rede (Network tab) e veja o JSON real da API.
- Ajuste o `fieldMappingKeys` no Model para mapear `nome_api` -> `NomeModel`.

### 2. Form não salva

**Causa:** O payload enviado está incompleto ou com formato errado.
**Solução:**

- Verifique o método `save` no Service.
- Confirme se os campos obrigatórios (`@Required`) estão preenchidos.

## Scaffolding Errors

### 1. "Gerou pastas vazias"

**Causa:** O JSON de entrada estava vazio ou mal formatado.
**Solução:**

- Verifique o arquivo em `output/json`.
- Rode `/gerar-json` novamente e observe se o Playwright realmente acessou a tela correta.

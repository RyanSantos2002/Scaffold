---
description: Implementa as ações capturadas no Service e no Formulário React
---

1. Implementar no Service
   - Localizar o arquivo de serviço da entidade (ex: `conta-service.ts`).
   - Importar interfaces necessárias:
     ```typescript
     import { type BaseResponseData } from "@/common/core/interfaces/api";
     import type {
       BaseSyncInput,
       BaseSyncOutput,
     } from "@/common/core/interfaces/api/base-sync-response";
     ```
   - Adicionar métodos para cada ação identificada, seguindo ESTRITAMENTE este padrão (NÃO USAR `postRequest` simplificado):

     ```typescript
     public async nomeAcao(id: number): Promise<BaseSyncOutput> {
       const response = await this._httpClient.request<BaseResponseData<BaseSyncInput>>({
         ...this._baseRequestParams,
         body: {
           controller: this._controller, // OU o Controller específico identificado (ex: M8Controllers.Pessoa)
           action: 'NomeDaAcaoNoBackend', // PascalCase (ex: FornecedorBloquearCadastro), conforme URL capturada.
           parameters: {
             id, // Verificar se o parâmetro no HTML é 'id', 'pessoaId', 'contaId', etc.
           },
         },
       });

       const data = response.body.data.data;

       return {
         mensagem: data.Mensagem,
         sucesso: data.Sucesso,
       };
     }
     ```

2. Implementar no Formulário (UI)
   - Localizar o componente principal do formulário (ex: `index.tsx`).
   - Adicionar imports (`useMutation`, `useToastContext`).
   - Criar `useMutation` para cada ação do service.
   - Configurar a prop `header` do `TabsForm` com o array `actions`.
   - Mapear cada botão para sua respectiva mutation (`onClick: () => mutation.mutate()`).
   - Aplicar regras de visibilidade (`hidden`) se identificadas.

3. Validar
   - Verificar se não há erros de lint/build.

4. Finalizar com Build

- Command: `npm run build`
- Cwd: `C:/Fontes/FrontM8`

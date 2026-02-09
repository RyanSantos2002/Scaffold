---
description: Gera documentação consolidada do projeto com telas, ações e regras de negócio
---

1. Execute o script de geração de documentação
   - Command: `node src/utils/generate-documentation.js`
   - Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

2. (Opcional) Gerar documentação formal/corporativa
   - Command: `node src/utils/generate-formal-documentation.js`
   - Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

3. (Recomendado) Gerar documentação detalhada com abas, models, services e pendências
   - Command: `node src/utils/generate-detailed-documentation.js`
   - Cwd: `c:/Users/Ryan.nunes/Desktop/Nova pasta/html-capture`

4. Revisar documentação gerada
   - Arquivo padrão: `docs/projeto-documentacao.md`
   - Arquivo formal: `docs/documentacao-tecnica.md`
   - Arquivo detalhado: `docs/documentacao-tecnica-detalhada.md` ⭐
   - Verificar se todas as telas estão listadas
   - Validar regras de negócio
   - Conferir métricas
   - Revisar pendências identificadas

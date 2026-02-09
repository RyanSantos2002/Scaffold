---
description: Captura HTML da tela atual e documenta ações e regras de negócio
---

1. Localizar HTML da Tela
   - Identificar o arquivo HTML gerado pelo scaffolding em `output/html/...` ou `output/Form/...`.
   - Exemplo: `*cadastro_id_*.html` ou `*_form_*.html`.

2. Analisar Estrutura do HTML
   - Ler o arquivo e buscar por:
     - Botões de Toolbar (`.btn-submit-formulario`, etc).
     - Menu "Ações" (`.dropdown-menu`, `m8-acoes-formulario`).
     - Scripts com chamadas `onclick` (ex: `contaAbas.onDesbloquear`).
     - **IMPORTANTE:** Analisar o corpo das funções chamadas nos scripts (geralmente no final do arquivo HTML) para identificar o `Ajax.post` ou `RequisicaoAjax`. Extrair a URL exata (ex: `/treinamento/Pessoa/FornecedorBloquearCadastro`) para identificar o Controller (`Pessoa`) e a Action (`FornecedorBloquearCadastro`).
     - Abas e seus comportamentos de carregamento (`onclick="AcaoGridExecutarCliqueAba..."`).
     - Dependências de campos (atributos `data-dependente` em `select2`).

3. Gerar Relatório de Regras
   - Compilar os achados em um arquivo markdown (ex: `regras_negocio_[tela].md`).
   - Listar:
     - Ações disponíveis (Bloquear, Desbloquear, etc).
     - Mapeamento de botões -> Funções.
     - Regras de validação visíveis no HTML.

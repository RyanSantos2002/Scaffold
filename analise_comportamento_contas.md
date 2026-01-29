# Análise de Comportamento, Regras de Negócio e Ações - Conta (CRM)

Este documento detalha as ações, regras de negócio e comportamentos identificados na análise do arquivo HTML capturado `Contas_form_9.html`.

## 1. Ações da Tela (Toolbar e Menu Ações)

A tela possui uma barra de ferramentas superior com ações principais e um menu dropdown de ações específicas.

### Botões Principais

- **Salvar**: Submete o formulário e permanece na tela.
- **Salvar e Novo**: Submete o formulário e, após o sucesso, limpa a tela para uma nova inclusão.
- **Salvar e Fechar**: Submete o formulário e fecha a aba/modal atual.
- **Configurar Campos**: Abre modal para configuração de visibilidade de campos.
- **Permissões**: Abre modal para visualizar usuários/grupos com acesso.
- **Logs**: Visualiza logs de operações do registro.
- **Tabela Banco Dados**: Exibe o nome da tabela do banco de dados correspondente.

### Menu "Ações" (Dropdown)

Este menu contém regras de negócio específicas acionadas via JavaScript (objeto `contaAbas`).

- **Desbloquear**: `contaAbas.onDesbloquear` - Provavelmente remove bloqueio de edição ou status do registro.
- **Bloquear**: `contaAbas.onBloquear` - Bloqueia o registro para certas operações.
- **Gerar Tarefa**: `contaAbas.onGerarTarefa` - Cria uma nova tarefa associada à conta.
- **Importar Lead RD Station**: `contaAbas.onRdStation` - Integração específica para importar dados do RD Station.

## 2. Navegação e Abas

A tela é dividida em abas carregadas dinamicamente ou estáticas.

- **Principal**: Carregada inicialmente.
- **Abas Carregadas via Clique (`AcaoGridExecutarCliqueAba`)**:
  - **Endereços**: Carrega grid `tblDetalhePessoaEndereco`.
  - **Contatos**: Carrega grid `tblDetalheContaContato`.
  - **Grupo Empresas**: Carrega grid `tblDetalheContaEmpresaGrupo`.
  - **Anexos**: Carrega grid `tblDetalheContaAnexo`.
  - **Orçamentos**: Carrega grid `tblContaOrcamento`.
  - **Meios de Pagamentos**: Carrega grid `tblDetalhePessoaMeioPagamento`.
  - **Follow Up**: Carrega grid `tblDetalheClienteFollowUpAnexo`.
  - **Tarefas**: Carrega grid `tblContaTarefas`.
  - **Histórico**: Carrega grid `tblHistoricoItemVenda`.
  - **Oportunidades**: Aba padrão (sem ação explícita de clique no HTML visível, mas pode ter inicialização automática).

## 3. Comportamento dos Campos (Regras de UI)

### Select2 (Listas de Seleção com Busca Ajax)

A maioria dos campos de relacionamento ("Lookup") utiliza o componente Select2 com comportamentos padronizados:

- **Busca Remota**: Realiza chamadas AJAX POST para endpoints específicos (ex: `/treinamento/Pessoa/TipoPessoasListaSelecao`).
- **Sincronização de Texto**: Ao selecionar um item, o texto visível é copiado para um campo oculto correspondente (ex: Selecionar `TipoPessoaId` atualiza `TipoPessoaNome`).
- **Navegação**: Ao fechar o dropdown (select ou esc), o foco tenta avançar para o próximo campo (`AvancarFocus`).

### Dependência entre Campos (Cascading Dropdowns)

Existem regras claras de dependência onde o valor de um campo filtra as opções do outro.

- **Município -> Bairro**: O campo `BairroId` depende de `MunicipioId`. A busca de bairros envia o ID do município selecionado.
- **Tipo Pessoa -> Múltiplos Campos**: Vários campos parecem ter dependência ou lógica atrelada ao tipo de pessoa, dado que `TipoPessoaId` é um campo chave.
- **Geral**: A lógica JavaScript verifica os atributos `data-dependente` e `data-valordependente` para injetar os valores dos campos pais nas requisições AJAX dos campos filhos.

### Botões de Apoio (Lupa e Mais)

Ao lado dos campos de seleção (Select2), existem botões de ação:

- **Pesquisar (Lupa)**: Abre um modal de pesquisa avançada (`ModalPesquisar...`). Ao retornar um valor, ele é setado no campo Select2 e dispara a validação.
- **Adicionar (Mais)**: Abre um modal ou nova aba para cadastrar um novo registro do tipo selecionado (ex: Novo Município).
  - Utiliza `localStorage` para monitorar quando o registro for salvo na outra aba/janela e atualizar automaticamente o campo no formulário original (`listenerValue`).

### Máscaras e Formatos

- **CPF/CNPJ**: Campo `CpfCnpj` possui máscara dinâmica.
- **Datas**: Campo `DataAbertura` valida formato de data.
- **Monetário**: `ReceitaAnual` usa máscara decimal.
- **Inteiro**: `NumeroFuncionarios`.
- **CEP**: `Cep` possui busca automática de endereço via `data-url-pesquisa="/treinamento/Enderecamento/BuscaCep"`.
- **Telefone**: Máscaras para telefones.

### Campos Somente Leitura e Ocultos

- `Id`: Sempre readonly.
- Campos com sufixo `Nome` (ex: `MunicipioNome`): Ocultos (`hidden="hidden"`), servem apenas para persistir a descrição do relacionamento.

## 4. Regras de Validação e Submissão

- **Validação Obrigatória**: O script `FfrmConta._validarCamposObrigatorios` verifica todos os campos visíveis com a classe `.obrigatorio` ou atributo configurado.
- **Limpeza de Máscaras**: Antes do submit, um script remove caracteres de formatação (pontos, traços) de campos como CPF, CNPJ, CEP e Telefone.
- **Tratamento de Submit**:
  - Previne o submit padrão do form.
  - Serializa os dados.
  - Envia via AJAX (`RequisicaoAjax`).
  - Exibe dialog de carregamento (`ajaxLoadContas`).
  - Trata sucesso (redireciona ou limpa) e erro (exibe alerta `bootbox`).
- **Restrição de Edição**: Existe um alerta visível: "ATENÇÃO! Só é permitido salvar alterações no cadastro de Estabelecimento/Empresa", sugerindo que certos dados são mestre e controlados em outro lugar.

## 5. Integrações Externas Identificadas

- **RD Station**: Botão explícito para integração.
- **Google Analytics/Tag Manager**: Scripts presentes no head para rastreamento.

## 6. Observações Técnicas

- **Scaffolding**: A estrutura sugere fortemente um padrão de scaffolding onde campos, modais de pesquisa e scripts de inicialização são gerados com base em metadados (atributos `data-m8-valorInicial`, `data-val`, etc.).
- **Gestão de Estado**: Uso intensivo de `localStorage` para comunicação entre abas (pattern `storageAba`).

## 7. Referências Adicionais

- **Metadados**: Foi identificado o arquivo `Contas_metadata.json` no mesmo diretório, que provavelmente contém as definições declarativas dos campos e regras que geraram este HTML. Recomenda-se a análise deste arquivo para uma visão completa das validações server-side e tipos de dados.

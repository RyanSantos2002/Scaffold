# Catálogo de Workflows - M8Arctec

Esta lista documenta todos os workflows automatizados disponíveis no sistema M8Arctec.

## Workflows de Conversão

| Comando                  | Descrição                                    | Quando usar                               |
| ------------------------ | -------------------------------------------- | ----------------------------------------- |
| `/gerar-json`            | Captura HTML e gera JSON estruturado.        | **Passo 1** de qualquer conversão.        |
| `/gerar-tela`            | Gera código React a partir do JSON.          | **Passo 2**, após validar o JSON.         |
| `/fix-scaffold`          | Correção básica de scaffolding.              | (Depreciado) Use a versão _enhanced_.     |
| `/fix-scaffold-enhanced` | Auditoria e correção profunda e inteligente. | **Passo 3**, obrigatório após gerar tela. |

## Workflows de Análise e Documentação

| Comando               | Descrição                                      | Quando usar                                  |
| --------------------- | ---------------------------------------------- | -------------------------------------------- |
| `/capturar-acoes`     | Extrai regras de negócio do HTML.              | **Passo 4**, para entender a lógica da tela. |
| `/auditar-tela`       | Gera relatório de fidelidade (Legado vs Novo). | Para QA e validação final.                   |
| `/gerar-documentacao` | Atualiza docs do projeto.                      | Ao finalizar uma sprint ou tela.             |
| `/documentar-projeto` | Gera documentação completa (este processo).    | Para handovers ou releases maiores.          |

## Workflows Auxiliares

| Comando              | Descrição                                        | Quando usar                                 |
| -------------------- | ------------------------------------------------ | ------------------------------------------- |
| `/auditar-tela`      | Apenas audit, sem corrigir.                      | Para verificar o estado sem alterar código. |
| `/implementar-acoes` | (Em desenvolvimento) Tenta codar lógica simples. | Experimental.                               |

---

## Como Criar um Novo Workflow

1.  Crie um arquivo `.md` na pasta `.agent/workflows/`.
2.  Adicione o cabeçalho YAML:
    ```yaml
    ---
    description: Descrição curta do que faz
    ---
    ```
3.  Descreva os passos em linguagem natural. O Agente interpretará e executará.
4.  Use anotações `// turbo` para permitir execução automática de comandos seguros.

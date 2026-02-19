/**
 * @Config/index.js - Configuração dos scripts Playwright para FrontM8 LOCAL
 *
 * ⚙️  AJUSTE AQUI antes de rodar qualquer script.
 */

module.exports = {

  // ─── SISTEMA ─────────────────────────────────────────────────────────────
  baseUrl  : 'http://localhost:5173',  // URL do FrontM8 local após npm run dev
  tenant   : 'Treinamento',            // Tenant exato da URL (case-sensitive)

  // ─── CREDENCIAIS (login automático) ──────────────────────────────────────
  username : 'ryan.nunes',
  password : 'Fred234!@',

  // ─── EMPRESA ─────────────────────────────────────────────────────────────
  // Texto do estabelecimento a selecionar (parcial ou completo)
  // Deixe vazio ('') para selecionar o primeiro disponível automaticamente
  empresaNome: '',

  // ─── TELA A CAPTURAR ──────────────────────────────────────────────────────
  // Rota completa da tela após o login (sem tenant)
  // Exemplo: 'financeiro/transferencia'
  rotaTela: 'financeiro/transferencia',

  // Nome usado para nomear os arquivos de saída
  nomeTela: 'LancamentoTransferencia',

  // ─── CAPTURA ─────────────────────────────────────────────────────────────
  // Keyword da URL da requisição a interceptar no formulário de edição
  keywordSync: 'sync',

};

/**
 * Configurações e Constantes Globais - Hetu
 */
const CONFIG = {
  SHEETS: {
    UI_CADASTRO: "UI_Cadastros",
    UI_FICHA: "UI_Ficha_Tecnica",
    DB_FORNECEDORES: "DB_Fornecedores",
    DB_INSUMOS: "DB_Insumos",
    DB_COMPRAS: "DB_Compras_Historico",
    DB_FICHAS: "DB_Fichas",
    DB_FICHAS_ITENS: "DB_Fichas_Itens",
    DB_UNIDADES: "DB_Unidades",
    DB_CAT_INSUMOS: "DB_Categoria_Insumo",
    DB_CAT_PRODUTOS: "DB_Categoria_Produto",
    DB_FICHAS_HISTORICO_CUSTOS: "DB_Fichas_Historico_Custos"
  }
};

// =========================================================
// Menu Suspenso
// =========================================================

/**
 * Executado automaticamente ao abrir a planilha.
 * Cria o menu personalizado na barra de ferramentas superior.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // Submenu: Aba de Cadastros
  const menuCadastros = ui.createMenu('📝 Cadastros')
    .addItem('🛒 Registrar Nova Compra', 'abrirModalCadastroCompras')
    .addItem('📋 Gerenciar Ficha Técnica/Produto', 'abrirModalFichaTecnica')
    .addItem('📦 Gerenciar Insumos', 'abrirModalInsumos')
    .addItem('🏷️ Categorias de Insumo', 'abrirModalCategoriasInsumo')
    .addItem('🏭 Fornecedores', 'abrirModalFornecedores');

  // Submenu: Aba de Relatórios & Análises
  const menuRelatorios = ui.createMenu('📊 Relatórios & Custos')
    .addItem('📈 Variação de Preços dos Insumos', 'abrirJanelaRelatorioInsumos')
    .addItem('💰 Variação de Custo de Produtos', 'abrirJanelaRelatorioFicha')
  // .addItem('🏭 Relatório de Produção', 'abrirRelatorioProducao')
  // .addItem('📤 Relatório de Saídas / Vendas', 'abrirRelatorioSaidas')
  // .addItem('📦 Estocagem & Valor do Estoque Atual', 'abrirRelatorioEstoque');

  // Submenu: Aba de Produção e Vendas
  const menuProducaoVendas = ui.createMenu('🏭 Produção & Vendas')
    .addItem('⚙️ Registro de Produção', 'abrirJanelaProducao')
  // .addItem('🛍️ Registro de Saídas', 'abrirModalRegistroSaidas');

  // Montagem do Menu Principal no Google Sheets
  ui.createMenu('🚀 Sistema de Gestão')
    .addSubMenu(menuCadastros)
    .addSeparator()
    .addSubMenu(menuProducaoVendas)
    .addSeparator()
    .addSubMenu(menuRelatorios)
    .addToUi();
}
/**
 * Abre o Modal de Gerenciamento de Categorias de Insumo
 */
function abrirModalCategoriasInsumo() {
  const html = HtmlService.createHtmlOutputFromFile('02_Modulos/ModCategoriaInsumo-CHECK/FormCategoriaInsumo')
      .setWidth(480)
      .setHeight(420)
      .setTitle('Gerenciar Categorias de Insumo');
  SpreadsheetApp.getUi().showModalDialog(html, 'Categorias de Insumo');
}

/**
 * Retorna todas as categorias de insumo cadastradas na aba DB_Categoria_Insumo
 */
function obterTodasCategoriasInsumo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCat = ss.getSheetByName(CONFIG.SHEETS.DB_CAT_INSUMOS);

  if (!wsCat || wsCat.getLastRow() < 2) return [];

  // Lê a partir da linha 2 (A2:B): Coluna A (1) = ID, Coluna B (2) = Nome
  const dados = wsCat.getRange(2, 1, wsCat.getLastRow() - 1, 2).getValues();

  return dados
    .filter(r => String(r[1]).trim() !== "")
    .map(r => ({
      id: r[0],
      nome: String(r[1]).trim()
    }));
}

/**
 * Salva uma nova categoria de insumo
 */
function salvarCategoriaInsumoHTML(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCat = ss.getSheetByName(CONFIG.SHEETS.DB_CAT_INSUMOS);

  const nomeCat = String(dados.nome).trim();

  if (!nomeCat) {
    return { sucesso: false, mensagem: "Digite o nome da categoria!" };
  }

  if (buscarLinhaPorColuna(wsCat, 2, nomeCat) !== -1) {
    return { sucesso: false, mensagem: `A categoria '${nomeCat}' já existe!` };
  }

  const proximoID = getProximoID(wsCat, 1);
  wsCat.appendRow([proximoID, nomeCat]);

  SpreadsheetApp.flush();
  return { sucesso: true, mensagem: "Categoria cadastrada com sucesso!" };
}

/**
 * Atualiza o nome de uma categoria existente
 */
function atualizarCategoriaInsumoHTML(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCat = ss.getSheetByName(CONFIG.SHEETS.DB_CAT_INSUMOS);

  const nomeAntigo = String(dados.nomeAntigo).trim();
  const nomeNovo = String(dados.nomeNovo).trim();

  if (!nomeAntigo || !nomeNovo) {
    return { sucesso: false, mensagem: "Selecione a categoria atual e informe o novo nome!" };
  }

  const linhaCat = buscarLinhaPorColuna(wsCat, 2, nomeAntigo);
  if (linhaCat !== -1) {
    wsCat.getRange(linhaCat, 2).setValue(nomeNovo);
    SpreadsheetApp.flush();
    return { sucesso: true, mensagem: "Categoria alterada com sucesso!" };
  } else {
    return { sucesso: false, mensagem: "Categoria não encontrada!" };
  }
}
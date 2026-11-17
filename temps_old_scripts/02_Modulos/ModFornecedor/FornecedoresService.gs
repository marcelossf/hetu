/**
 * Abre a janela modal do CRUD de Fornecedores
 */
function abrirModalFornecedores() {
  const html = HtmlService.createHtmlOutputFromFile('02_Modulos/ModFornecedor/FormFornecedor')
      .setWidth(500)
      .setHeight(480)
      .setTitle('Gerenciamento de Fornecedores');
  SpreadsheetApp.getUi().showModalDialog(html, 'Fornecedores');
}

/**
 * Retorna todos os fornecedores cadastrados para popular a consulta/edição na tela
 */
function obterTodosFornecedores() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);
  
  if (wsForn.getLastRow() < 2) return [];
  
  // Colunas: Coluna A = ID (1), Coluna B = Nome (2), Coluna C = Endereço (3), Coluna D = Ativo (4)
  const dados = wsForn.getRange(5, 1, wsForn.getLastRow() - 1, 4).getValues();
  
  return dados
    .filter(r => String(r[1]).trim() !== "")
    .map(r => ({
      id: r[0],
      nome: String(r[1]).trim(),
      endereco: String(r[2]).trim(),
      ativo: String(r[3] || "Sim").trim()
    }));
}

/**
 * Processa a criação de um novo fornecedor
 */
function criarFornecedorHTML(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);
  
  const nome = String(dados.nome).trim();
  const endereco = String(dados.endereco).trim();

  if (!nome || !endereco) {
    return { sucesso: false, mensagem: "Preencha Nome e Endereço!" };
  }

  // Verifica se já existe fornecedor com mesmo nome
  if (buscarLinhaPorColuna(wsForn, 2, nome) !== -1) {
    return { sucesso: false, mensagem: `O fornecedor '${nome}' já está cadastrado!` };
  }

  const proximoID = getProximoID(wsForn, 1);
  wsForn.appendRow([proximoID, nome, endereco, "Sim"]);
  
  SpreadsheetApp.flush();
  return { sucesso: true, mensagem: "Fornecedor cadastrado com sucesso!" };
}

/**
 * Processa a atualização de um fornecedor existente
 */
function atualizarFornecedorHTML(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);
  
  const nomeAntigo = String(dados.nomeAntigo).trim();
  const nomeNovo = String(dados.nomeNovo).trim();
  const endereco = String(dados.endereco).trim();
  const ativo = String(dados.ativo).trim() || "Sim";

  if (!nomeAntigo || !nomeNovo) {
    return { sucesso: false, mensagem: "Selecione um fornecedor e informe o novo nome!" };
  }

  const linhaForn = buscarLinhaPorColuna(wsForn, 2, nomeAntigo);
  if (linhaForn !== -1) {
    // Atualiza Nome, Endereço e Ativo (Colunas B, C e D)
    wsForn.getRange(linhaForn, 2, 1, 3).setValues([[nomeNovo, endereco, ativo]]);
    SpreadsheetApp.flush();
    return { sucesso: true, mensagem: "Fornecedor atualizado com sucesso!" };
  } else {
    return { sucesso: false, mensagem: "Fornecedor não encontrado no banco de dados!" };
  }
}
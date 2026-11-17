/**
 * Trigger simples disparado automaticamente em qualquer edição manual.
 * Centraliza os eventos de 'Worksheet_Change' de todas as abas.
 */
function onEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  const range = e.range;
  const row = range.getRow();
  const col = range.getColumn();
  const cellA1 = range.getA1Notation();

  // Ignora edições em múltiplas células/intervalos ao mesmo tempo
  if (range.getNumRows() > 1 || range.getNumColumns() > 1) return;


  // =========================================================
  // 1. EVENTO DA ABA: DB_INSUMOS (Histórico de Compras)
  // =========================================================
  if (sheetName === CONFIG.SHEETS.DB_INSUMOS) {
    if (row > 1 && (col === 2 || col === 3 || col === 5)) {
      processarHistoricoCompra(sheet, row);
    }
    return;
  }


  // =========================================================
  // 2. EVENTO DA ABA: UI_CADASTROS (Busca Automática)
  // =========================================================
  if (sheetName === CONFIG.SHEETS.UI_CADASTRO) {
    if (cellA1 === "H12") {
      processarBuscaFornecedorUI(sheet);
    }
    if (cellA1 === "M12") {
      processarBuscaInsumoUI(sheet);
    }
    return;
  }


  // =========================================================
  // 3. EVENTO DA ABA: UI_FICHA_TECNICA
  // =========================================================
// Verifica se a alteração foi na célula A3 da aba UI_Ficha_Tecnica
  if (sheetName === CONFIG.SHEETS.UI_FICHA && cellA1 === "A3") {
    carregarFichaTecnica();
  }

  // Edição do Rendimento em B3 -> Recalcula as quantidades
  if (cellA1 === "B3") {
    recalcularRendimentoFicha(e);
    return;
  }
}


// =========================================================
// FUNÇÕES AUXILIARES DA FICHA TÉCNICA
// =========================================================

/**
 * Puxa dados da Unidade Base e Última Compra do Insumo na Ficha Técnica (G5:G33)
 */
function processarInsumoFichaTecnica(wsUI, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsIns = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
  let wsComp = ss.getSheetByName("HISTÓRICO-COMPRA") || ss.getSheetByName("DB_Compras_Historico");

  const nomeInsumo = String(wsUI.getRange(row, 7).getValue()).trim();

  // Se apagou o nome do insumo, limpa as colunas H até M da linha
  if (!nomeInsumo) {
    wsUI.getRange(`H${row}:M${row}`).clearContent();
    // Restaura a fórmula na coluna M
    wsUI.getRange(`M${row}`).setFormula(`=IF(AND(I${row}>0, J${row}>0), (L${row} * J${row}) / I${row}, 0)`);
    return;
  }

  // 1. Busca o Insumo na aba DB_INSUMOS
  const linhaIns = buscarLinhaPorColuna(wsIns, 2, nomeInsumo); // Coluna B (2) = Nome

  if (linhaIns !== -1) {
    const idInsumo = wsIns.getRange(linhaIns, 1).getValue(); // Coluna A (1) = ID
    const unidadeBase = wsIns.getRange(linhaIns, 4).getValue(); // Coluna D (4) = Unidade Base

    // Preenche a Unidade Base na coluna H
    wsUI.getRange(row, 8).setValue(unidadeBase);

    // 2. Busca a última compra no histórico pelo ID ou Nome do Insumo
    if (wsComp && wsComp.getLastRow() > 1) {
      const dadosComp = wsComp.getRange(2, 1, wsComp.getLastRow() - 1, wsComp.getLastColumn()).getValues();

      // Percorre de trás para frente para pegar a última compra realizada
      for (let i = dadosComp.length - 1; i >= 0; i--) {
        const itemHistorico = String(dadosComp[i][1]).trim(); // Coluna B = Nome do Insumo / ID

        if (itemHistorico === nomeInsumo || itemHistorico == idInsumo) {
          // Exemplo de estrutura no Histórico:
          // Coluna 2 (B): Insumo | Coluna 3 (C): Valor Unitário (ou Qtd/Valor)
          // Ajusta os valores para a grade (Qtd, Valor Total, Unidade Compra)
          const valorUnitario = Number(dadosComp[i][2]) || 0;

          wsUI.getRange(row, 9).setValue(1); // Quantidade padrão 1
          wsUI.getRange(row, 10).setValue(valorUnitario); // Valor Total
          wsUI.getRange(row, 11).setValue(unidadeBase); // Unidade Compra
          break;
        }
      }
    }
  } else {
    // Caso não encontre no BD, limpa os campos de suporte
    wsUI.getRange(`H${row}:M${row}`).clearContent();
    wsUI.getRange(`M${row}`).setFormula(`=IF(AND(I${row}>0, J${row}>0), (L${row} * J${row}) / I${row}, 0)`);
  }
}


// =========================================================
// OUTRAS FUNÇÕES AUXILIARES DE SUPORTE AOS TRIGGERS
// =========================================================

function processarBuscaFornecedorUI(wsUI) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);
  const nomeBusca = String(wsUI.getRange("H12").getValue()).trim();

  if (!nomeBusca) {
    wsUI.getRange("I12:K12").clearContent();
    return;
  }

  const linhaForn = buscarLinhaPorColuna(wsForn, 2, nomeBusca);
  if (linhaForn !== -1) {
    const endereco = wsForn.getRange(linhaForn, 3).getValue();
    const ativo = wsForn.getRange(linhaForn, 4).getValue();

    wsUI.getRange("I12").setValue(nomeBusca);
    wsUI.getRange("J12").setValue(endereco);
    wsUI.getRange("K12").setValue(ativo);
  } else {
    wsUI.getRange("I12:K12").clearContent();
  }
}

function processarBuscaInsumoUI(wsUI) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsIns = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
  const nomeBusca = String(wsUI.getRange("M12").getValue()).trim();

  if (!nomeBusca) {
    wsUI.getRange("N12:P12").clearContent();
    return;
  }

  const linhaIns = buscarLinhaPorColuna(wsIns, 2, nomeBusca);
  if (linhaIns !== -1) {
    const unidade = wsIns.getRange(linhaIns, 4).getValue();
    const categoria = wsIns.getRange(linhaIns, 6).getValue();
    const ativo = wsIns.getRange(linhaIns, 7).getValue();

    wsUI.getRange("N12").setValue(unidade);
    wsUI.getRange("O12").setValue(categoria);
    wsUI.getRange("P12").setValue(ativo);
  } else {
    wsUI.getRange("N12:P12").clearContent();
  }
}

function processarHistoricoCompra(wsInsumos, row) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let wsHistorico = ss.getSheetByName("HISTÓRICO-COMPRA");

  if (!wsHistorico) {
    wsHistorico = ss.insertSheet("HISTÓRICO-COMPRA");
  }

  if (wsHistorico.getLastRow() === 0 || wsHistorico.getRange("A1").getValue() === "") {
    wsHistorico.getRange("A1:D1").setValues([["Data", "Insumo", "Valor Unitário", "Fornecedor"]]);
    wsHistorico.getRange("A1:D1").setFontWeight("bold");
  }

  const insumo = String(wsInsumos.getRange(row, 1).getValue()).trim();
  const quantidade = Number(wsInsumos.getRange(row, 2).getValue());
  const valorCompra = Number(wsInsumos.getRange(row, 3).getValue());
  const fornecedor = String(wsInsumos.getRange(row, 5).getValue()).trim();

  if (!insumo || !quantidade || !valorCompra || quantidade <= 0) return;

  const valorUnitario = valorCompra / quantidade;
  const lastRowHist = wsHistorico.getLastRow();
  let encontrouRegistro = false;
  let ultimoValorHist = 0;
  let ultimoFornHist = "";

  if (lastRowHist > 1) {
    const dadosHist = wsHistorico.getRange(2, 1, lastRowHist - 1, 4).getValues();

    for (let i = dadosHist.length - 1; i >= 0; i--) {
      if (String(dadosHist[i][1]).trim() === insumo) {
        ultimoValorHist = Number(dadosHist[i][2]);
        ultimoFornHist = String(dadosHist[i][3]).trim();
        encontrouRegistro = true;
        break;
      }
    }
  }

  if (encontrouRegistro) {
    const valorUnitArredondado = Math.round(valorUnitario * 10000) / 10000;
    const ultimoValorArredondado = Math.round(ultimoValorHist * 10000) / 10000;

    if (valorUnitArredondado === ultimoValorArredondado && fornecedor === ultimoFornHist) {
      return;
    }
  }

  const hoje = new Date();
  const novaLinha = wsHistorico.getLastRow() + 1;

  wsHistorico.getRange(novaLinha, 1).setValue(hoje).setNumberFormat("dd/mm/yyyy");
  wsHistorico.getRange(novaLinha, 2).setValue(insumo);
  wsHistorico.getRange(novaLinha, 3).setValue(valorUnitario).setNumberFormat("R$ #,##0.00");
  wsHistorico.getRange(novaLinha, 4).setValue(fornecedor);
}

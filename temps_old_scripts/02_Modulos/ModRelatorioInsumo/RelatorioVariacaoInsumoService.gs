/**
 * Abre a janela modal do Relatório de Variação de Insumos
 */
function abrirJanelaRelatorioInsumos() {
  const html = HtmlService.createTemplateFromFile('02_Modulos/ModRelatorioInsumo/RelatorioVariacaoInsumoInterface')
    .evaluate()
    .setWidth(850)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Relatório - Variação de Preço de Insumo');
}

/**
 * Retorna a lista de insumos cadastrados para popular o select
 */
function obterDadosIniciaisRelatorioInsumos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaInsumos = ss.getSheetByName('DB_Insumos');
  
  if (!abaInsumos || abaInsumos.getLastRow() < 2) {
    return { insumos: [] };
  }

  const dados = abaInsumos.getRange(2, 1, abaInsumos.getLastRow() - 1, 3).getValues();
  const insumos = dados
    .filter(row => row[0] !== "" && row[0] !== null)
    .map(row => ({
      id: String(row[0]),
      nome: row[1]
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { insumos: insumos };
}

/**
 * Consulta o histórico de compras filtrado por Insumo e Período
 */
function consultarHistoricoInsumo(filtros) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaHistorico = ss.getSheetByName('DB_Compras_Historico');
  const abaFornecedores = ss.getSheetByName('DB_Fornecedores');

  if (!abaHistorico || abaHistorico.getLastRow() < 2) {
    return { sucesso: true, dados: [] };
  }

  // Mapeia Fornecedores (ID -> Nome) para exibição na tabela
  const mapFornecedores = {};
  if (abaFornecedores && abaFornecedores.getLastRow() >= 2) {
    const dadosForn = abaFornecedores.getRange(2, 1, abaFornecedores.getLastRow() - 1, 2).getValues();
    dadosForn.forEach(f => {
      mapFornecedores[String(f[0])] = f[1];
    });
  }

  const dataInicio = new Date(filtros.dataInicio + 'T00:00:00');
  const dataFim = new Date(filtros.dataFim + 'T23:59:59');
  const idInsumoAlvo = String(filtros.idInsumo);

  const dadosRaw = abaHistorico.getRange(2, 1, abaHistorico.getLastRow() - 1, 8).getValues();
  const resultado = [];

  dadosRaw.forEach(row => {
    const idInsumoRow = String(row[2]);
    if (idInsumoRow !== idInsumoAlvo) return;

    // Trata a data da linha (Aceita Objeto Date ou String DD/MM/YYYY HH:mm:ss)
    let dataRow = row[1];
    if (!(dataRow instanceof Date)) {
      if (typeof dataRow === 'string') {
        const partes = dataRow.split(' ')[0].split('/');
        if (partes.length === 3) {
          dataRow = new Date(partes[2], partes[1] - 1, partes[0]);
        } else {
          dataRow = new Date(dataRow);
        }
      }
    }

    if (dataRow >= dataInicio && dataRow <= dataFim) {
      const idFornecedor = String(row[3]);
      resultado.push({
        idCompra: row[0],
        data: Utilities.formatDate(dataRow, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
        dataObj: dataRow.getTime(),
        fornecedor: mapFornecedores[idFornecedor] || idFornecedor || "Não Inf.",
        quantidade: Number(row[4]) || 0,
        unidade: row[5] || "",
        valorTotal: Number(row[6]) || 0,
        valorUnitario: Number(row[7]) || 0
      });
    }
  });

  // Ordena por data (mais antiga para mais recente para formação do gráfico)
  resultado.sort((a, b) => a.dataObj - b.dataObj);

  return { sucesso: true, dados: resultado };
}
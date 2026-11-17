/**
 * Abre a janela modal do Relatório de Variação de Custo de Ficha
 */
function abrirJanelaRelatorioFicha() {
  const html = HtmlService.createTemplateFromFile('02_Modulos/ModRelatorioFicha/RelatorioVariacaoCustoFichaInterface')
    .evaluate()
    .setWidth(880)
    .setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(html, 'Relatório - Variação de Custo de Produto');
}

/**
 * Retorna a lista de fichas e APENAS os insumos pertencentes a cada uma delas.
 * Mapeamento Exato:
 * DB_Fichas_Itens -> B (Col 2): ID_Ficha, C (Col 3): ID_Insumo
 * DB_Insumos      -> A (Col 1): ID_Insumo, B (Col 2): Nome
 * DB_Fichas       -> A (Col 1): ID_Ficha, B (Col 2): Nome_Receita
 */
function obterDadosIniciaisRelatorioFicha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaFichas = ss.getSheetByName('DB_Fichas_Tecnicas') || ss.getSheetByName('DB_Fichas');
  const abaFichasItens = ss.getSheetByName('DB_Fichas_Itens');
  const abaInsumos = ss.getSheetByName('DB_Insumos');
  
  if (!abaFichas || abaFichas.getLastRow() < 2) {
    return { fichas: [] };
  }

  // 1. Mapeia Nome dos Insumos (DB_Insumos: Coluna A = ID_Insumo, Coluna B = Nome)
  const mapInsumos = {};
  if (abaInsumos && abaInsumos.getLastRow() >= 2) {
    const dadosIns = abaInsumos.getRange(2, 1, abaInsumos.getLastRow() - 1, 2).getValues();
    dadosIns.forEach(i => { 
      const idInsumo = String(i[0]).trim();
      const nomeInsumo = String(i[1]).trim();
      if (idInsumo) mapInsumos[idInsumo] = nomeInsumo; 
    });
  }

  // 2. Mapeia os Insumos por Ficha (DB_Fichas_Itens: Coluna B = ID_Ficha, Coluna C = ID_Insumo)
  const mapInsumosPorFicha = {};
  if (abaFichasItens && abaFichasItens.getLastRow() >= 2) {
    // Pega as colunas B e C (da coluna 2 até a 3)
    const dadosItens = abaFichasItens.getRange(2, 2, abaFichasItens.getLastRow() - 1, 2).getValues();
    
    dadosItens.forEach(row => {
      const idFicha = String(row[0]).trim();  // Coluna B (ID_Ficha)
      const idInsumo = String(row[1]).trim(); // Coluna C (ID_Insumo)
      const nomeInsumo = mapInsumos[idInsumo];

      if (idFicha && nomeInsumo) {
        if (!mapInsumosPorFicha[idFicha]) {
          mapInsumosPorFicha[idFicha] = new Set();
        }
        mapInsumosPorFicha[idFicha].add(nomeInsumo);
      }
    });
  }

  // 3. Monta a lista final (DB_Fichas: Coluna A = ID_Ficha, Coluna B = Nome_Receita)
  const dados = abaFichas.getRange(2, 1, abaFichas.getLastRow() - 1, 2).getValues();
  const cabecalhosIgnorar = ['nome_receita', 'nome', 'id_ficha', 'id', 'ficha'];

  const fichas = dados
    .filter(row => {
      const id = String(row[0]).trim();
      const nome = String(row[1]).trim().toLowerCase();
      return id !== "" && nome !== "" && !cabecalhosIgnorar.includes(nome) && !cabecalhosIgnorar.includes(id.toLowerCase());
    })
    .map(row => {
      const idFicha = String(row[0]).trim();
      const setInsumos = mapInsumosPorFicha[idFicha] || new Set();
      
      return {
        id: idFicha,
        nome: row[1],
        insumos: Array.from(setInsumos).map(nome => ({ nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      };
    })
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { fichas: fichas };
}

/**
 * Consulta o histórico de alterações filtrado por Ficha, Período e Insumo (Opcional)
 */
function consultarHistoricoFicha(filtros) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abaHistoricoCustos = ss.getSheetByName('DB_Fichas_Historico_Custos');
  const abaInsumos = ss.getSheetByName('DB_Insumos');

  if (!abaHistoricoCustos || abaHistoricoCustos.getLastRow() < 2) {
    return { sucesso: true, dados: [] };
  }

  // Mapeia Insumos (ID -> Nome)
  const mapInsumos = {};
  if (abaInsumos && abaInsumos.getLastRow() >= 2) {
    const dadosIns = abaInsumos.getRange(2, 1, abaInsumos.getLastRow() - 1, 2).getValues();
    dadosIns.forEach(i => {
      mapInsumos[String(i[0])] = i[1];
    });
  }

  const dataInicio = new Date(filtros.dataInicio + 'T00:00:00');
  const dataFim = new Date(filtros.dataFim + 'T23:59:59');
  const idFichaAlvo = String(filtros.idFicha);
  const insumoFiltroNome = filtros.insumo ? String(filtros.insumo).trim() : "";

  const dadosRaw = abaHistoricoCustos.getRange(2, 1, abaHistoricoCustos.getLastRow() - 1, 9).getValues();
  const resultado = [];

  dadosRaw.forEach(row => {
    const idFichaRow = String(row[2]);
    if (idFichaRow !== idFichaAlvo) return;

    // Trata a data
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
      const idInsumo = String(row[3]);
      const nomeInsumoReal = mapInsumos[idInsumo] || idInsumo || "Não Inf.";

      // SE O FILTRO DE INSUMO ESTIVER ATIVO, IGNORA SE NÃO FOR O MESMO
      if (insumoFiltroNome !== "" && nomeInsumoReal !== insumoFiltroNome) {
        return;
      }

      resultado.push({
        idHistorico: row[0],
        data: Utilities.formatDate(dataRow, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm"),
        dataObj: dataRow.getTime(),
        insumoAlterado: nomeInsumoReal,
        precoAnterior: Number(row[4]) || 0,
        precoNovo: Number(row[5]) || 0,
        impactoDiferenca: Number(row[6]) || 0,
        novoCustoTotal: Number(row[7]) || 0,
        idCompraOrigem: row[8] || "-"
      });
    }
  });

  // Ordena cronologicamente
  resultado.sort((a, b) => a.dataObj - b.dataObj);

  return { sucesso: true, dados: resultado };
}
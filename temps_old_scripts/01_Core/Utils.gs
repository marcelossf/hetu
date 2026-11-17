/**
 * Funções Auxiliares Globais
 */

// Retorna o próximo ID incremental de uma coluna na tabela
function getProximoID(sheet, colIndex) {
  if (!sheet) {
    throw new Error("A aba informada para a função getProximoID é inválida ou não foi encontrada na planilha. Verifique o CONFIG.SHEETS.");
  }
  
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return 1; // Se só tem cabeçalho ou está vazia, o primeiro ID é 1
  
  const data = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  let maxID = 0;
  
  for (let i = 0; i < data.length; i++) {
    const val = Number(data[i][0]);
    if (!isNaN(val) && val > maxID) {
      maxID = val;
    }
  }
  
  return maxID + 1;
}

/**
 * Busca uma linha por um valor específico em uma coluna de uma aba, ignorando diferenças de espaços duplos.
 */
function buscarLinhaPorColuna(sheet, colunaIndex, valorBuscado) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return -1;

  const values = sheet.getRange(1, colunaIndex, lastRow, 1).getValues();
  
  // Normaliza o texto removendo espaços duplicados e aplicando minúsculo
  const alvo = String(valorBuscado).replace(/\s+/g, " ").trim().toLowerCase();

  for (let i = 0; i < values.length; i++) {
    const celula = String(values[i][0]).replace(/\s+/g, " ").trim().toLowerCase();
    if (celula === alvo) {
      return i + 1; // Retorna o número da linha (1-based)
    }
  }

  return -1;
}

/**
 * Lê os dados de uma aba tratando cabeçalhos e ignorando linhas vazias.
 * @param {string} sheetName - Nome da aba (ex: 'DB_Fichas_Itens')
 * @returns {Array<Object>}
 */
function getSheetDataAsObjects(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error(`A aba '${sheetName}' não foi encontrada.`);

  const range = sheet.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return [];

  // Encontra a primeira linha que de fato contém o cabeçalho
  let headerRowIndex = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i].some(cell => String(cell).trim() !== "")) {
      headerRowIndex = i;
      break;
    }
  }

  // Normaliza os nomes das colunas (remove espaços extras e caracteres especiais)
  const headers = values[headerRowIndex].map(h => 
    String(h)
      .trim()
      .replace(/[\u200B-\u200D\uFEFF]/g, "") // Remove caracteres invisíveis de formatação
  );

  const data = [];

  for (let i = headerRowIndex + 1; i < values.length; i++) {
    let rowObj = {};
    let temConteudo = false;

    for (let j = 0; j < headers.length; j++) {
      if (headers[j] !== "") {
        rowObj[headers[j]] = values[i][j];
        if (values[i][j] !== "" && values[i][j] !== null) temConteudo = true;
      }
    }

    if (temConteudo) data.push(rowObj);
  }

  return data;
}

/**
 * Gera o snapshot granular na DB_Fichas_Historico_Custos após o salvamento de compras em lote.
 * @param {Array<Object>} itensComprados - Lista com { idInsumo, precoAnterior, precoNovo, idCompra }
 */
/**
 * Gera o snapshot em DB_Fichas_Historico_Custos aplicando arredondamento financeiro (2 casas decimais).
 */
function gerarSnapshotHistoricoCustos(itensComprados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const wsHistorico = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS_HISTORICO_CUSTOS || 'DB_Fichas_Historico_Custos');
  const wsFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');

  const fichasItens = getSheetDataAsObjects(CONFIG.SHEETS.DB_FICHAS_ITENS || 'DB_Fichas_Itens');
  const fichas = getSheetDataAsObjects(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');

  const dataHoje = new Date();

  // Função auxiliar para arredondamento seguro em 2 casas decimais
  const round2 = (num) => Math.round((Number(num) + Number.EPSILON) * 100) / 100;

  // Mapeia custos atuais de DB_Fichas em memória
  let mapaCustosFichas = {};
  fichas.forEach(f => {
    const key = String(f.ID_Ficha || f["ID_Ficha"] || f["ID Ficha"] || "").trim();
    if (key) mapaCustosFichas[key] = Number(f.Custo_Unitario || f["Custo_Unitario"] || 0);
  });

  itensComprados.forEach(item => {
    const idInsumo = String(item.idInsumo).trim();
    const precoAnt = round2(item.precoAnterior);
    const precoNovo = round2(item.precoNovo);
    const idCompra = item.idCompra;

    const diffInsumo = precoNovo - precoAnt;

    // Busca todas as fichas técnicas que utilizam esse insumo
    const fichasAfetadas = fichasItens.filter(fi => {
      const val = String(fi.ID_Insumo || fi["ID_Insumo"] || fi["ID Insumo"] || fi.Id_Insumo || "").trim();
      return val === idInsumo;
    });

    fichasAfetadas.forEach(fa => {
      const idFicha = String(fa.ID_Ficha || fa["ID_Ficha"] || fa["ID Ficha"] || fa.Id_Ficha || "").trim();
      const qtdInsumo = Number(fa.Qtd_Insumo || fa.Quantidade || fa["Qtd_Insumo"] || 0);

      // Impacto financeiro real e arredondado
      const impactoDiferencaBrl = round2(diffInsumo * qtdInsumo);

      const custoAnteriorFicha = mapaCustosFichas[idFicha] || 0;
      const novoCustoTotalFicha = round2(custoAnteriorFicha + impactoDiferencaBrl);
      mapaCustosFichas[idFicha] = novoCustoTotalFicha;

      const idHistorico = getProximoID(wsHistorico, 1);

      // Grava histórico com valores formatados
      wsHistorico.appendRow([
        idHistorico,
        dataHoje,
        idFicha,
        idInsumo,
        precoAnt,               // Preco_Insumo_Anterior (ex: 89.09)
        precoNovo,              // Preco_Insumo_Novo (ex: 91.67)
        impactoDiferencaBrl,    // Impacto_Diferenca_Brl (ex: 0.26)
        novoCustoTotalFicha,    // Novo_Custo_Total_Ficha (ex: 20.14)
        idCompra
      ]);
    });
  });

  // Atualiza os valores finais na aba DB_Fichas
  atualizarCustosFichasAba(wsFichas, mapaCustosFichas);
}

/**
 * Atualiza a coluna Custo_Unitario na aba DB_Fichas.
 */
function atualizarCustosFichasAba(wsFichas, mapaCustosFichas) {
  const range = wsFichas.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return;

  const headers = values[0].map(h => String(h).trim());
  const idxIdFicha = headers.indexOf('ID_Ficha');
  const idxCustoUnitario = headers.indexOf('Custo_Unitario');

  if (idxIdFicha === -1 || idxCustoUnitario === -1) return;

  for (let i = 1; i < values.length; i++) {
    const idFicha = values[i][idxIdFicha];
    if (mapaCustosFichas[idFicha] !== undefined) {
      wsFichas.getRange(i + 1, idxCustoUnitario + 1).setValue(mapaCustosFichas[idFicha]);
    }
  }
}

/**
 * Atualiza o Custo_Unitario na tbl_Fichas para as fichas que sofreram alteração.
 */
function atualizarCustosFichasTabela(tabelaFichas, mapaCustosFichas) {
  const range = tabelaFichas.getDataRange();
  const values = range.getValues();
  const headers = values[0];
  
  const idxIdFicha = headers.indexOf('ID_Ficha');
  const idxCustoUnitario = headers.indexOf('Custo_Unitario');

  for (let i = 1; i < values.length; i++) {
    const idFicha = values[i][idxIdFicha];
    if (mapaCustosFichas[idFicha] !== undefined) {
      // Atualiza a célula correspondente na tabela
      range.getCell(i + 1, idxCustoUnitario + 1).setValue(mapaCustosFichas[idFicha]);
    }
  }
}

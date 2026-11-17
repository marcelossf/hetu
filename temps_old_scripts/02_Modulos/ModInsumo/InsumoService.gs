/**
 * Abre o Modal de Gerenciamento de Insumos
 */
function abrirModalInsumos() {
  const html = HtmlService.createHtmlOutputFromFile('02_Modulos/ModInsumo/InsumoInterface')
      .setWidth(680)
      .setHeight(520)
      .setTitle('Gerenciamento de Insumos');
  SpreadsheetApp.getUi().showModalDialog(html, 'Insumos');
}

/**
 * Retorna dados para o formulário serializados em JSON para evitar falhas de transmissão do Apps Script
 */
function obterDadosParaInsumos() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    
    const wsIns = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
    const wsCat = ss.getSheetByName(CONFIG.SHEETS.DB_CAT_INSUMOS);
    const wsUni = ss.getSheetByName(CONFIG.SHEETS.DB_UNIDADES);

    if (!wsIns) throw new Error(`Aba não encontrada: ${CONFIG.SHEETS.DB_INSUMOS}`);
    if (!wsCat) throw new Error(`Aba não encontrada: ${CONFIG.SHEETS.DB_CAT_INSUMOS}`);
    if (!wsUni) throw new Error(`Aba não encontrada: ${CONFIG.SHEETS.DB_UNIDADES}`);

    // 1. Categorias
    let listaCategorias = [];
    const ultLinhaCat = wsCat.getLastRow();
    if (ultLinhaCat >= 2) {
      const dadosCat = wsCat.getRange(2, 1, ultLinhaCat - 1, 2).getValues();
      listaCategorias = dadosCat
        .filter(r => String(r[1] || "").trim() !== "")
        .map(r => ({ id: String(r[0] || ""), nome: String(r[1]).trim() }));
    }

    // 2. Unidades
    let listaUnidades = [];
    const ultLinhaUni = wsUni.getLastRow();
    if (ultLinhaUni >= 2) {
      const dadosUni = wsUni.getRange(2, 1, ultLinhaUni - 1, 2).getValues();
      listaUnidades = dadosUni
        .filter(r => String(r[1] || "").trim() !== "")
        .map(r => ({ id: String(r[0] || ""), nome: String(r[1]).trim() }));
    }

    // 3. Insumos
    let listaInsumos = [];
    const ultLinhaIns = wsIns.getLastRow();
    if (ultLinhaIns >= 2) {
      const dadosIns = wsIns.getRange(2, 1, ultLinhaIns - 1, 7).getValues();
      listaInsumos = dadosIns
        .filter(r => String(r[1] || "").trim() !== "")
        .map(r => ({
          id: String(r[0] || ""),
          nome: String(r[1]).trim(),
          unidade: String(r[2] || "").trim(),
          categoria: String(r[3] || "").trim(),
          custoEstimadoUnitario: Number(r[4]) || 0,
          estoqueAtual: Number(r[5]) || 0,
          ativo: String(r[6] || "Sim").trim()
        }));
    }

    // Retorna serializado como String pura para ignorar limitações de objetos do Apps Script
    return JSON.stringify({
      categorias: listaCategorias,
      unidades: listaUnidades,
      insumos: listaInsumos
    });

  } catch (erro) {
    Logger.log("ERRO em obterDadosParaInsumos: " + erro.message);
    return JSON.stringify({
      categorias: [],
      unidades: [],
      insumos: [],
      erro: erro.message
    });
  }
}

/**
 * Salva múltiplos insumos em lote
 */
function salvarInsumosEmLoteHTML(itens) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsIns = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);

  if (!itens || itens.length === 0) {
    return { sucesso: false, mensagem: "Nenhum insumo informado!" };
  }

  let inseridos = 0;
  let duplicados = [];

  for (let item of itens) {
    const nome = String(item.nome).trim();
    const unidade = String(item.unidade).trim();
    const categoria = String(item.categoria).trim();
    const custo = Number(item.custoEstimadoUnitario) || 0;
    const estoque = Number(item.estoqueAtual) || 0;

    if (!nome || !unidade) continue;

    // Valida duplicidade pela Coluna B (Nome)
    if (buscarLinhaPorColuna(wsIns, 2, nome) !== -1) {
      duplicados.push(nome);
      continue;
    }

    const proximoID = getProximoID(wsIns, 1);
    
    // Ordem correta: [ID_Insumo, Nome, Unidade, Categoria, Custo_Estimado_Unitario, Estoque_Atual, Ativo]
    wsIns.appendRow([proximoID, nome, unidade, categoria, custo, estoque, "Sim"]);
    inseridos++;
  }

  SpreadsheetApp.flush();

  let msg = `${inseridos} insumo(s) cadastrado(s) com sucesso!`;
  if (duplicados.length > 0) {
    msg += ` Os seguintes itens já existiam e foram ignorados: ${duplicados.join(', ')}`;
  }

  return { sucesso: true, mensagem: msg };
}

/**
 * Atualiza as informações de um insumo existente
 */
function atualizarInsumoHTML(dados) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsIns = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);

  const nome = String(dados.nome).trim();
  const unidade = String(dados.unidade).trim();
  const categoria = String(dados.categoria).trim();
  const estoqueAtual = Number(dados.estoqueAtual) || 0;
  const ativo = String(dados.ativo).trim() || "Sim";

  if (!nome || !unidade) {
    return { sucesso: false, mensagem: "Preencha todos os campos para atualização!" };
  }

  const linhaIns = buscarLinhaPorColuna(wsIns, 2, nome);
  if (linhaIns !== -1) {
    // 1. Atualiza Unidade e Categoria (Colunas C e D)
    wsIns.getRange(linhaIns, 3, 1, 2).setValues([[unidade, categoria]]);
    
    // 2. Atualiza Estoque_Atual (Coluna F / Coluna 6) — Preserva Custo_Estimado_Unitario na Coluna E (5)
    wsIns.getRange(linhaIns, 6).setValue(estoqueAtual);

    // 3. Atualiza Ativo (Coluna G / Coluna 7)
    wsIns.getRange(linhaIns, 7).setValue(ativo);

    SpreadsheetApp.flush();
    return { sucesso: true, mensagem: `Insumo '${nome}' atualizado com sucesso!` };
  } else {
    return { sucesso: false, mensagem: "Insumo não encontrado no banco de dados!" };
  }
}
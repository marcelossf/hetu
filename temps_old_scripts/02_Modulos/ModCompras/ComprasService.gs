/**
 * Módulo de Gestão de Cadastros (Compras em Lote, Fornecedores, Insumos e Categorias)
 * Plataforma Hetu
 */

// =========================================================
// 1. GRAVAÇÃO DE COMPRAS EM LOTE (UI_Cadastros)
// =========================================================
function SalvarComprasEmLote() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  SpreadsheetApp.flush(); // Força o envio de alterações pendentes na tela

  const wsUI = ss.getSheetByName(CONFIG.SHEETS.UI_CADASTRO);
  const wsCompras = ss.getSheetByName(CONFIG.SHEETS.DB_COMPRAS);
  const wsInsumos = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);
  const ui = SpreadsheetApp.getUi();

  // 1. Validação do preenchimento das linhas (7 a 15)
  for (let i = 7; i <= 15; i++) {
    const rowValues = wsUI.getRange(`A${i}:F${i}`).getValues()[0];
    const temDado = rowValues.some(val => String(val).trim() !== "");

    if (temDado) {
      const nomeInsumo = String(rowValues[0]).trim();
      const qtd = Number(rowValues[1]);
      const unUso = String(rowValues[2]).trim();
      const preco = Number(rowValues[3]);
      const nomeForn = String(rowValues[4]).trim();

      if (!nomeInsumo || isNaN(qtd) || qtd <= 0 || !unUso || isNaN(preco) || preco <= 0 || !nomeForn) {
        ui.alert("Atenção", `Preenchimento incompleto na Linha ${i}!`, ui.ButtonSet.OK);
        return;
      }
    }
  }

  // 2. Processamento e Gravação
  const hoje = new Date();
  let itensCompradosParaSnapshot = []; // Array para guardar os itens e disparar o snapshot

  for (let i = 7; i <= 15; i++) {
    const rowValues = wsUI.getRange(`A${i}:F${i}`).getValues()[0];
    const temDado = rowValues.some(val => String(val).trim() !== "");

    if (temDado) {
      const nomeInsumo = String(rowValues[0]).trim();
      const qtd = Number(rowValues[1]);
      const unUso = String(rowValues[2]).trim();
      const preco = Number(rowValues[3]);
      const nomeForn = String(rowValues[4]).trim();
      let dataCompra = rowValues[5];

      if (!dataCompra || String(dataCompra).trim() === "") {
        dataCompra = hoje;
      } else {
        dataCompra = new Date(dataCompra);
      }

      const valorUnitarioCompra = preco / qtd;
      let idInsFinal = 0;
      let precoAnteriorInsumo = 0;
      let novoCustoMedioInsumo = 0;
      let linhaIns = buscarLinhaPorColuna(wsInsumos, 2, nomeInsumo); // Coluna 2 = Nome

      // --- ATUALIZAÇÃO / CÁLCULO DO CUSTO MÉDIO PONDERADO DO INSUMO ---
      if (linhaIns !== -1) {
        idInsFinal = wsInsumos.getRange(linhaIns, 1).getValue(); // Coluna A (1) = ID_Insumo
        
        // Captura Custo Estimado Atual (Coluna E = 5) e Estoque Atual (Coluna F = 6)
        precoAnteriorInsumo = Number(wsInsumos.getRange(linhaIns, 5).getValue() || 0);
        const estoqueAtualInsumo = Number(wsInsumos.getRange(linhaIns, 6).getValue() || 0);

        const estoqueTotalComprado = estoqueAtualInsumo + qtd;
        
        // Cálculo do Custo Médio Ponderado
        if (estoqueTotalComprado > 0 && precoAnteriorInsumo > 0) {
          novoCustoMedioInsumo = ((estoqueAtualInsumo * precoAnteriorInsumo) + (qtd * valorUnitarioCompra)) / estoqueTotalComprado;
        } else {
          novoCustoMedioInsumo = valorUnitarioCompra;
        }

        // Escreve de volta na DB_INSUMOS
        wsInsumos.getRange(linhaIns, 5).setValue(novoCustoMedioInsumo); // Coluna E = Custo_Estimado_Unitario
        wsInsumos.getRange(linhaIns, 6).setValue(estoqueTotalComprado);  // Coluna F = Estoque_Atual

      } else {
        // Insumo Novo (assume os valores da 1ª compra)
        idInsFinal = getProximoID(wsInsumos, 1);
        precoAnteriorInsumo = valorUnitarioCompra;
        novoCustoMedioInsumo = valorUnitarioCompra;
        
        // Cadastra: [ID_Insumo, Nome, Unidade, Categoria, Custo_Estimado_Unitario, Estoque_Atual]
        wsInsumos.appendRow([idInsFinal, nomeInsumo, unUso, "", novoCustoMedioInsumo, qtd]);
      }

      // Verifica / Cadastra Fornecedor (Coluna B = Nome_Fornecedor)
      let idFornFinal = 0;
      let linhaForn = buscarLinhaPorColuna(wsForn, 2, nomeForn);

      if (linhaForn !== -1) {
        idFornFinal = wsForn.getRange(linhaForn, 1).getValue();
      } else {
        idFornFinal = getProximoID(wsForn, 1);
        wsForn.appendRow([idFornFinal, nomeForn, "", "Sim"]);
      }

      // Grava Histórico de Compra
      const idCompra = getProximoID(wsCompras, 1);

      wsCompras.appendRow([
        idCompra,
        dataCompra,
        idInsFinal,
        idFornFinal,
        qtd,
        unUso,
        preco,
        valorUnitarioCompra
      ]);

      // Repassa o Custo Médio Recalculado para o Snapshot das Fichas
      itensCompradosParaSnapshot.push({
        idInsumo: idInsFinal,
        precoAnterior: precoAnteriorInsumo,
        precoNovo: novoCustoMedioInsumo,
        idCompra: idCompra
      });
    }
  }

  // 3. Dispara o Snapshot e Atualização de Custos das Fichas se houver itens comprados
  if (itensCompradosParaSnapshot.length > 0) {
    gerarSnapshotHistoricoCustos(itensCompradosParaSnapshot);
  }

  // Limpa a grade de digitação e atualiza
  wsUI.getRange("A7:F15").clearContent();
  SpreadsheetApp.flush();
  ui.alert("Sucesso", "Compras salvas com sucesso!", ui.ButtonSet.OK);
}

/**
 * Abre o Modal de Cadastro de Compras HTML
 */
function abrirModalCadastroCompras() {
  const html = HtmlService.createHtmlOutputFromFile('02_Modulos/ModCompras/ComprasInterface')
      .setWidth(680)
      .setHeight(480)
      .setTitle('Registrar Nova Compra em Lote');
  SpreadsheetApp.getUi().showModalDialog(html, 'Nova Compra');
}

/**
 * Retorna as listas de Insumos e Fornecedores cadastrados para popular o formulário HTML
 */
function obterDadosParaFormularioCompras() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsInsumos = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);

  let listaInsumos = [];
  const ultimaLinhaInsumos = wsInsumos.getLastRow();
  
  // Garante que só lê se houver dados a partir da linha 6
  if (ultimaLinhaInsumos >= 2) {
    const totalLinhasInsumos = ultimaLinhaInsumos - 5; // Total de linhas de dados (descontando o cabeçalho das linhas 1 a 5)
    const dadosInsumos = wsInsumos.getRange(2, 1, totalLinhasInsumos, 3).getValues();
    
    listaInsumos = dadosInsumos
      .filter(r => String(r[1]).trim() !== "")
      .map(r => ({ nome: r[1], unidade: r[2] }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  let listaFornecedores = [];
  const ultimaLinhaForn = wsForn.getLastRow();
  
  // Garante que só lê se houver dados a partir da linha 5
  if (ultimaLinhaForn >= 5) {
    const totalLinhasForn = ultimaLinhaForn - 4; // Descontando cabeçalho das linhas 1 a 4
    const dadosForn = wsForn.getRange(5, 1, totalLinhasForn, 2).getValues();
    
    listaFornecedores = dadosForn
      .filter(r => String(r[1]).trim() !== "")
      .map(r => ({ nome: r[1] }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  return {
    insumos: listaInsumos,
    fornecedores: listaFornecedores
  };
}

/**
 * Processa e Grava os dados enviados a partir do formulário HTML
 */
function processarComprasHTML(payload) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsCompras = ss.getSheetByName(CONFIG.SHEETS.DB_COMPRAS);
  const wsInsumos = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS);
  const wsForn = ss.getSheetByName(CONFIG.SHEETS.DB_FORNECEDORES);

  const dataCompra = new Date(payload.dataCompra + "T00:00:00");
  const nomeForn = String(payload.nomeFornecedor).trim();

  // 1. Verifica / Cadastra Fornecedor
  let idFornFinal = 0;
  let linhaForn = buscarLinhaPorColuna(wsForn, 2, nomeForn);

  if (linhaForn !== -1) {
    idFornFinal = wsForn.getRange(linhaForn, 1).getValue();
  } else {
    idFornFinal = getProximoID(wsForn, 1);
    wsForn.appendRow([idFornFinal, nomeForn, "", "Sim"]);
  }

  let itensCompradosParaSnapshot = [];

  // 2. Loop sobre os itens enviados pelo HTML
  for (let item of payload.itens) {
    let nomeInsumo = String(item.nomeInsumo).trim();
    let qtd = Number(item.qtd);
    let unUso = String(item.unidade).trim();
    let preco = Number(item.preco);

    const valorUnitarioCompra = preco / qtd;
    let idInsFinal = 0;
    let precoAnteriorInsumo = 0;
    let novoCustoMedioInsumo = 0;

    let linhaIns = buscarLinhaPorColuna(wsInsumos, 2, nomeInsumo);

    // --- CÁLCULO E ATUALIZAÇÃO DA DB_INSUMOS ---
    if (linhaIns !== -1) {
      idInsFinal = wsInsumos.getRange(linhaIns, 1).getValue();
      
      // Captura Custo Estimado Atual (Coluna E = 5) e Estoque Atual (Coluna F = 6)
      precoAnteriorInsumo = Number(wsInsumos.getRange(linhaIns, 5).getValue() || 0);
      const estoqueAtualInsumo = Number(wsInsumos.getRange(linhaIns, 6).getValue() || 0);

      const estoqueTotalComprado = estoqueAtualInsumo + qtd;

      // Custo Médio Ponderado
      if (estoqueTotalComprado > 0 && precoAnteriorInsumo > 0) {
        novoCustoMedioInsumo = ((estoqueAtualInsumo * precoAnteriorInsumo) + (qtd * valorUnitarioCompra)) / estoqueTotalComprado;
      } else {
        novoCustoMedioInsumo = valorUnitarioCompra;
      }

      // Escreve de volta na DB_INSUMOS
      wsInsumos.getRange(linhaIns, 5).setValue(novoCustoMedioInsumo); // Coluna E = Custo_Estimado_Unitario
      wsInsumos.getRange(linhaIns, 6).setValue(estoqueTotalComprado);  // Coluna F = Estoque_Atual

    } else {
      // Insumo Novo (assume o valor da 1ª compra)
      idInsFinal = getProximoID(wsInsumos, 1);
      precoAnteriorInsumo = valorUnitarioCompra;
      novoCustoMedioInsumo = valorUnitarioCompra;

      // Cadastra: [ID_Insumo, Nome, Unidade, Categoria, Custo_Estimado_Unitario, Estoque_Atual, Ativo]
      wsInsumos.appendRow([idInsFinal, nomeInsumo, unUso, "", novoCustoMedioInsumo, qtd, "Sim"]);
    }

    const idCompra = getProximoID(wsCompras, 1);

    // Grava na DB_COMPRAS
    wsCompras.appendRow([
      idCompra,
      dataCompra,
      idInsFinal,
      idFornFinal,
      qtd,
      unUso,
      preco,
      valorUnitarioCompra
    ]);

    itensCompradosParaSnapshot.push({
      idInsumo: idInsFinal,
      precoAnterior: precoAnteriorInsumo,
      precoNovo: novoCustoMedioInsumo,
      idCompra: idCompra
    });
  }

  // 3. Dispara o Snapshot e Atualização das Fichas Técnicas
  if (itensCompradosParaSnapshot.length > 0 && typeof gerarSnapshotHistoricoCustos === 'function') {
    gerarSnapshotHistoricoCustos(itensCompradosParaSnapshot);
  }

  SpreadsheetApp.flush();
  return "Compras registradas com sucesso!";
}

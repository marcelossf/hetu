/**
 * Abre a janela modal da Calculadora e Ordem de Produção
 */
function abrirJanelaProducao() {
  const html = HtmlService.createTemplateFromFile('02_Modulos/ModProducao-CHECK/ProducaoInterface')
    .evaluate()
    .setWidth(900)
    .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(html, 'Calculadora & Ordem de Produção');
}

/**
 * Retorna as Fichas Técnicas ativas para preencher o select
 */
function obterDadosIniciaisProducao() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');

  if (!wsFichas || wsFichas.getLastRow() < 2) {
    return { fichas: [] };
  }

  const dados = wsFichas.getRange(2, 1, wsFichas.getLastRow() - 1, 12).getValues();
  
  const fichas = dados
    .filter(r => r[0] && String(r[11]).toLowerCase() !== "não" && String(r[11]).toLowerCase() !== "nao")
    .map(r => ({
      id: String(r[0]),
      nome: String(r[1]).trim(),
      custoUnitario: Number(r[7]) || 0
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

  return { fichas };
}

/**
 * Calcula dinamicamente a necessidade de insumos com base no Rendimento Desejado
 */
function obterDetalhamentoCalculoProducao(idFicha, rendimentoDesejado) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');
  const wsItens = ss.getSheetByName('DB_Fichas_Itens');
  const wsInsumos = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS || 'DB_Insumos');

  const rend = Number(rendimentoDesejado) || 1;

  // 1. Busca Custo Unitário Atual da Ficha
  const dadosFichas = wsFichas.getRange(2, 1, wsFichas.getLastRow() - 1, 8).getValues();
  const ficha = dadosFichas.find(f => String(f[0]).trim() === String(idFicha).trim());
  const custoUnitario = ficha ? Number(ficha[7]) || 0 : 0;

  // 2. Mapeia Insumos (ID -> {Nome, Unidade, Preco, Estoque})
  const mapInsumos = {};
  if (wsInsumos && wsInsumos.getLastRow() >= 2) {
    const dadosIns = wsInsumos.getRange(2, 1, wsInsumos.getLastRow() - 1, 7).getValues();
    dadosIns.forEach(r => {
      mapInsumos[String(r[0]).trim()] = {
        nome: r[1],
        unidade: r[2] || "un",
        precoUnitario: Number(r[4]) || 0,
        estoqueAtual: Number(r[5]) || 0
      };
    });
  }

  // 3. Busca Itens da Ficha e Multiplica pela Quantidade Desejada
  const itensCalculados = [];
  if (wsItens && wsItens.getLastRow() >= 2) {
    const dadosItens = wsItens.getRange(2, 1, wsItens.getLastRow() - 1, 4).getValues();
    
    dadosItens.forEach(r => {
      const idFichaItem = String(r[1]).trim();
      if (idFichaItem === String(idFicha).trim()) {
        const idInsumo = String(r[2]).trim();
        const qtdUnitarioBase = Number(r[3]) || 0; // Quantidade para 1 unidade
        
        const insumoInfo = mapInsumos[idInsumo] || { nome: "Insumo Desconhecido", unidade: "un", precoUnitario: 0, estoqueAtual: 0 };
        
        const qtdNecessariaLote = qtdUnitarioBase * rend;
        const custoTotalInsumo = qtdNecessariaLote * insumoInfo.precoUnitario;
        const estoqueSuficiente = insumoInfo.estoqueAtual >= qtdNecessariaLote;

        itensCalculados.push({
          idInsumo: idInsumo,
          nome: insumoInfo.nome,
          unidade: insumoInfo.unidade,
          qtdNecessaria: qtdNecessariaLote,
          custoUnitario: insumoInfo.precoUnitario,
          custoTotal: custoTotalInsumo,
          estoqueAtual: insumoInfo.estoqueAtual,
          estoqueSuficiente: estoqueSuficiente
        });
      }
    });
  }

  return {
    idFicha: idFicha,
    rendimento: rend,
    custoUnitario: custoUnitario,
    custoTotalLote: custoUnitario * rend,
    itens: itensCalculados
  };
}

/**
 * Registra a produção de um produto, dá baixa nos insumos e incrementa o estoque do produto.
 */
function registrarProducao(idProduto, qtdProduzida, observacao = "") {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const wsFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');
  const wsProducao = ss.getSheetByName(CONFIG.SHEETS.DB_PRODUCAO || 'DB_Producao');
  const wsItens = ss.getSheetByName('DB_Fichas_Itens');
  const wsInsumos = ss.getSheetByName(CONFIG.SHEETS.DB_INSUMOS || 'DB_Insumos');

  if (!wsFichas || !wsProducao) {
    throw new Error("Abas DB_Fichas ou DB_Producao não foram encontradas.");
  }

  // 1. Busca o produto em DB_Fichas
  const fichas = getSheetDataAsObjects(CONFIG.SHEETS.DB_FICHAS || 'DB_Fichas');
  const produto = fichas.find(f => String(f.ID_Ficha || f.ID_Produto).trim() === String(idProduto).trim());

  if (!produto) {
    throw new Error(`Produto ID '${idProduto}' não foi encontrado na DB_Fichas.`);
  }

  const custoUnitarioMomento = Number(produto.Custo_Unitario || 0);
  const custoTotalLote = custoUnitarioMomento * Number(qtdProduzida);
  const estoqueAtualAntigo = Number(produto.Estoque_Atual || 0);
  const novoEstoqueAtual = estoqueAtualAntigo + Number(qtdProduzida);

  // 2. Grava o Lote em DB_Producao (tbl_Producao)
  const idProducao = getProximoID(wsProducao, 1);
  const dataHoje = new Date();

  wsProducao.appendRow([
    idProducao,           // Coluna A
    dataHoje,             // Coluna B
    idProduto,            // Coluna C
    qtdProduzida,         // Coluna D
    custoUnitarioMomento, // Coluna E
    custoTotalLote,       // Coluna F
    observacao            // Coluna G
  ]);

  // 3. Atualiza o Estoque do Produto Acabado na DB_Fichas
  atualizarEstoqueFicha(wsFichas, idProduto, novoEstoqueAtual);

  // 4. Dá Baixa Automática no Estoque dos Insumos
  if (wsItens && wsInsumos && wsItens.getLastRow() >= 2) {
    const dadosItens = wsItens.getRange(2, 1, wsItens.getLastRow() - 1, 4).getValues();
    const dadosInsumos = wsInsumos.getRange(2, 1, wsInsumos.getLastRow() - 1, 6).getValues();

    dadosItens.forEach(item => {
      if (String(item[1]).trim() === String(idProduto).trim()) {
        const idInsumo = String(item[2]).trim();
        const qtdUnitBase = Number(item[3]) || 0;
        const qtdConsumidaLote = qtdUnitBase * Number(qtdProduzida);

        // Procura a linha do insumo na DB_Insumos para atualizar a Coluna F (Estoque_Atual)
        for (let i = 0; i < dadosInsumos.length; i++) {
          if (String(dadosInsumos[i][0]).trim() === idInsumo) {
            const estoqueAtualInsumo = Number(dadosInsumos[i][5]) || 0;
            const novoEstoqueInsumo = Math.max(0, estoqueAtualInsumo - qtdConsumidaLote);
            wsInsumos.getRange(i + 2, 6).setValue(novoEstoqueInsumo); // Coluna F = Estoque_Atual
            break;
          }
        }
      }
    });
  }

  SpreadsheetApp.flush();
  return { sucesso: true, mensagem: `Lote de ${qtdProduzida} un do produto salvo e estoques atualizados!` };
}

/**
 * Função Auxiliar para atualizar a Coluna K (Estoque_Atual) da DB_Fichas
 */
function atualizarEstoqueFicha(wsFichas, idProduto, novoEstoque) {
  const range = wsFichas.getDataRange();
  const values = range.getValues();
  if (values.length <= 1) return;

  const headers = values[0].map(h => String(h).trim());
  const idxId = headers.indexOf('ID_Ficha') !== -1 ? headers.indexOf('ID_Ficha') : headers.indexOf('ID_Produto');
  const idxEstoque = headers.indexOf('Estoque_Atual');

  const colIndex = idxEstoque !== -1 ? idxEstoque + 1 : 11; 

  for (let i = 1; i < values.length; i++) {
    if (String(values[i][idxId]).trim() === String(idProduto).trim()) {
      wsFichas.getRange(i + 1, colIndex).setValue(novoEstoque);
      break;
    }
  }
}
/**
 * Módulo de Gestão de Fichas Técnicas e Produtos (UI_Ficha_Tecnica & DB_Fichas)
 */

function abrirModalFichaTecnica() {
  const html = HtmlService.createHtmlOutputFromFile('02_Modulos/ModFichaTecnica/FichaTecnicaInterface')
      .setWidth(750)
      .setHeight(600)
      .setTitle('Gerenciador de Fichas Técnicas');
  SpreadsheetApp.getUi().showModalDialog(html, 'Fichas Técnicas');
}

/**
 * Retorna insumos completos (ID, Nome, Preço Unitário, Unidade) para o cálculo no HTML
 */
function obterDadosIniciaisFicha() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Resgate das abas considerando fallback de nomes caso CONFIG não esteja definido
  const wsIns = ss.getSheetByName(typeof CONFIG !== 'undefined' && CONFIG.SHEETS ? CONFIG.SHEETS.DB_INSUMOS : "DB_Insumos");
  const wsCatProd = ss.getSheetByName(typeof CONFIG !== 'undefined' && CONFIG.SHEETS ? CONFIG.SHEETS.DB_CAT_PRODUTOS : "DB_Categoria_Produto");
  const wsDBFichas = ss.getSheetByName(typeof CONFIG !== 'undefined' && CONFIG.SHEETS ? CONFIG.SHEETS.DB_FICHAS : "DB_Fichas");

  // Função auxiliar para validar linhas com dados válidos
  const ehLinhaValida = (r) => {
    if (!r[0] || r[0] === "") return false;
    const id = String(r[0]).trim().toLowerCase();
    const nome = String(r[1]).trim().toLowerCase();
    
    // Ignora cabeçalhos comuns e linhas vazias
    const cabecalhosIgnorar = ["id", "id_insumo", "id_ficha", "id_categoria"];
    return !cabecalhosIgnorar.includes(id) && nome !== "";
  };

  // 1. Insumos (DB_Insumos: A=ID_Insumo, B=Nome, C=Unidade, D=Categoria, E=Custo_Estimado_Unitario)
  let insumos = [];
  if (wsIns && wsIns.getLastRow() >= 2) {
    const dadosIns = wsIns.getRange(2, 1, wsIns.getLastRow() - 1, 5).getValues();
    insumos = dadosIns
      .filter(ehLinhaValida)
      .map(r => ({
        id: r[0],
        nome: String(r[1]).trim(),
        unidade: String(r[2] || "un").trim(),
        precoUnitario: Number(r[4]) || 0
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // 2. Categorias de Produtos (DB_Categoria_Produto: A=ID, B=Nome)
  let categorias = [];
  if (wsCatProd && wsCatProd.getLastRow() >= 2) {
    const dadosCat = wsCatProd.getRange(2, 1, wsCatProd.getLastRow() - 1, 2).getValues();
    categorias = dadosCat
      .filter(ehLinhaValida)
      .map(r => ({
        id: r[0],
        nome: String(r[1]).trim()
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  // 3. Fichas existentes (DB_Fichas: A=ID_Ficha, B=Nome_Receita)
  let fichas = [];
  if (wsDBFichas && wsDBFichas.getLastRow() >= 2) {
    const dadosFichas = wsDBFichas.getRange(2, 1, wsDBFichas.getLastRow() - 1, 2).getValues();
    fichas = dadosFichas
      .filter(ehLinhaValida)
      .map(r => ({
        id: r[0],
        nome: String(r[1]).trim()
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }

  return { insumos, categorias, fichas };
}

/**
 * Carrega a ficha preenchendo todos os itens com os seus respectivos preços unitários
 */
function obterFichaPorIdHTML(idFicha) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const wsDBFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS);
  const wsDBItens = ss.getSheetByName("DB_Fichas_Itens");

  const linhaCab = buscarLinhaPorColuna(wsDBFichas, 1, idFicha);
  if (linhaCab === -1) return { sucesso: false, mensagem: "Ficha não encontrada!" };

  const dadosFicha = wsDBFichas.getRange(linhaCab, 1, 1, 12).getValues()[0];

  const ficha = {
    id: dadosFicha[0],
    nomeReceita: dadosFicha[1] || "",
    rendimento: Number(dadosFicha[2]) || 1,
    embUnit: Number(dadosFicha[3]) || 0,
    maoObraUnit: Number(dadosFicha[4]) || 0,
    armazUnit: Number(dadosFicha[5]) || 0,
    custoTotal: Number(dadosFicha[6]) || 0,
    custoUnitario: Number(dadosFicha[7]) || 0,
    idCategoria: dadosFicha[8] || "",
    precoVenda: Number(dadosFicha[9]) || 0,
    estoqueAtual: Number(dadosFicha[10]) || 0,
    ativo: dadosFicha[11] || "Sim",
    itens: []
  };

  if (wsDBItens && wsDBItens.getLastRow() >= 2) {
    const dadosItens = wsDBItens.getDataRange().getValues();
    for (let i = 1; i < dadosItens.length; i++) {
      if (String(dadosItens[i][1]) === String(idFicha)) {
        ficha.itens.push({
          idInsumo: dadosItens[i][2],
          qtdUnitaria: Number(dadosItens[i][3]) || 0
        });
      }
    }
  }

  return { sucesso: true, ficha: ficha };
}

/**
 * Salva Ficha vindo do HTML
 */
function salvarFichaTecnicaHTML(dados) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsDBFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS);
    const wsDBItens = ss.getSheetByName("DB_Fichas_Itens");

    // Função auxiliar para arredondamento seguro de casas decimais
    const arredondar = (num, casas = 6) => Number(Math.round(num + "e" + casas) + "e-" + casas);

    const rendimento = Number(dados.rendimento) || 1;
    
    // Normalização dos custos adicionais unitários
    const embUnit = arredondar(Number(dados.custoEmbalagem) / rendimento);
    const maoObraUnit = arredondar(Number(dados.custoMaoObra) / rendimento);
    const armazUnit = arredondar(Number(dados.custoArmazenamento) / rendimento);
    
    const custoTotalReceita = Number(dados.custoTotalCalculado) || 0;
    const custoUnit = arredondar(Number(dados.custoUnitarioCalculado) || (custoTotalReceita / rendimento));

    let idFichaFinal = dados.id ? dados.id : getProximoID(wsDBFichas, 1);
    let linhaCab = dados.id ? buscarLinhaPorColuna(wsDBFichas, 1, dados.id) : buscarLinhaPorColuna(wsDBFichas, 2, dados.nomeReceita);

    const linhaDadosDB = [
      idFichaFinal,
      dados.nomeReceita,
      1, // Rendimento padronizado/normalizado como 1
      embUnit,
      maoObraUnit,
      armazUnit,
      arredondar(custoTotalReceita / rendimento),
      custoUnit,
      dados.idCategoria,
      arredondar(Number(dados.precoVenda) || 0, 2), // Preço de venda em 2 casas (R$)
      Number(dados.estoqueAtual) || 0,
      dados.ativo || "Sim"
    ];

    if (linhaCab !== -1) {
      linhaDadosDB[0] = wsDBFichas.getRange(linhaCab, 1).getValue();
      idFichaFinal = linhaDadosDB[0];
      wsDBFichas.getRange(linhaCab, 1, 1, 12).setValues([linhaDadosDB]);
      removerItensFicha(wsDBItens, idFichaFinal);
    } else {
      wsDBFichas.appendRow(linhaDadosDB);
    }

    if (dados.itens && dados.itens.length > 0) {
      dados.itens.forEach(item => {
        if (item.idInsumo && Number(item.qtd) > 0) {
          // Normaliza a quantidade do item para 6 casas decimais
          const qtdUnit = arredondar(Number(item.qtd) / rendimento, 6);
          const idItem = getProximoID(wsDBItens, 1);
          wsDBItens.appendRow([idItem, idFichaFinal, item.idInsumo, qtdUnit]);
        }
      });
    }

    SpreadsheetApp.flush();
    return { sucesso: true, mensagem: `Ficha '${dados.nomeReceita}' salva com sucesso!` };
  } catch (err) {
    return { sucesso: false, mensagem: "Erro ao salvar ficha: " + err.message };
  }
}

function excluirFichaTecnicaHTML(idFicha) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const wsDBFichas = ss.getSheetByName(CONFIG.SHEETS.DB_FICHAS);
    const wsDBItens = ss.getSheetByName("DB_Fichas_Itens");

    const linhaCab = buscarLinhaPorColuna(wsDBFichas, 1, idFicha);
    if (linhaCab !== -1) {
      removerItensFicha(wsDBItens, idFicha);
      wsDBFichas.deleteRow(linhaCab);
      SpreadsheetApp.flush();
      return { sucesso: true, mensagem: "Ficha Técnica excluída com sucesso!" };
    }
    return { sucesso: false, mensagem: "Ficha não encontrada para exclusão!" };
  } catch (err) {
    return { sucesso: false, mensagem: "Erro ao excluir: " + err.message };
  }
}

/**
 * Remove todos os itens associados a um ID de ficha técnica na aba DB_Fichas_Itens
 */
function removerItensFicha(wsDBItens, idFicha) {
  if (!wsDBItens || wsDBItens.getLastRow() < 2) return;

  const dadosItens = wsDBItens.getDataRange().getValues();
  // Percorre da última linha para a primeira para deletar sem desalinhar os índices das linhas
  for (let i = dadosItens.length - 1; i >= 1; i--) {
    if (String(dadosItens[i][1]) === String(idFicha)) {
      wsDBItens.deleteRow(i + 1);
    }
  }
}
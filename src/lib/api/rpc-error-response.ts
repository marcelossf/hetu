type RpcError = {
  code: string;
  message: string;
};

const invalidInputMessages: Record<string, string> = {
  AUTH_REQUIRED: "Entre com sua conta para continuar.",
  INVALID_PRODUCT_DATA: "Confira os dados do produto.",
  INVALID_RECIPE_ITEMS: "Informe os insumos da ficha em um formato válido.",
  TOO_MANY_RECIPE_ITEMS: "A ficha pode ter no máximo 100 insumos.",
  INVALID_RECIPE_ITEM: "Confira as quantidades dos insumos da ficha.",
  DUPLICATE_RECIPE_INGREDIENT: "Remova os insumos repetidos da ficha.",
  INGREDIENT_NOT_FOUND_OR_INACTIVE: "Um dos insumos não existe ou está inativo.",
  PRODUCT_CATEGORY_NOT_FOUND: "A categoria de produto não foi encontrada.",
  INVALID_STOCK_ADJUSTMENT: "Confira a quantidade e o motivo do ajuste.",
  INSUFFICIENT_PRODUCT_STOCK: "O ajuste deixaria o estoque do produto negativo.",
  INVALID_PRODUCTION_DATA: "Confira a quantidade e a observação da produção.",
  PRODUCT_NOT_FOUND_OR_INACTIVE: "O produto não existe ou está inativo.",
  INVALID_SALE_ITEMS: "Informe os produtos da venda.",
  INVALID_SALE_ITEM_COUNT: "A venda deve ter entre 1 e 100 produtos.",
  INVALID_SALE_ITEM: "Confira os produtos e quantidades da venda.",
  DUPLICATE_SALE_PRODUCT: "Remova produtos repetidos da venda.",
  INVALID_SALE_NOTES: "A observação da venda excede o limite permitido.",
  SALES_CHANNEL_NOT_FOUND_OR_INACTIVE: "O canal não existe ou está inativo.",
  SALE_TOTAL_CHANGED_OR_INVALID_DISCOUNT:
    "O desconto ou os valores dos produtos estão desatualizados.",
  INVALID_SALE_PAYMENTS: "Informe as formas de pagamento em um formato válido.",
  INVALID_SALE_PAYMENT: "Confira os valores e formas de pagamento.",
  SALE_PAYMENTS_DO_NOT_MATCH_TOTAL:
    "A soma dos pagamentos deve corresponder ao total da venda.",
  SALE_ALREADY_CANCELLED: "Esta venda já foi cancelada.",
  SALE_PRODUCT_NOT_FOUND: "Um produto da venda não foi encontrado.",
};

export function rpcErrorResponse(error: RpcError): Response | null {
  const insufficientIngredient = error.message.match(
    /INSUFFICIENT_INGREDIENT:([^\r\n]+)/,
  );
  if (insufficientIngredient) {
    return Response.json(
      { error: `Estoque insuficiente do insumo ${insufficientIngredient[1]}.` },
      { status: 409 },
    );
  }

  const insufficientProduct = error.message.match(
    /INSUFFICIENT_PRODUCT_STOCK:([^\r\n]+)/,
  );
  if (insufficientProduct) {
    return Response.json(
      { error: `Estoque insuficiente do produto ${insufficientProduct[1]}.` },
      { status: 409 },
    );
  }

  if (error.code === "23505") {
    return Response.json(
      { error: "Já existe um registro com esses dados." },
      { status: 409 },
    );
  }

  const knownNotFound = [
    "PRODUCT_NOT_FOUND",
    "SALE_NOT_FOUND",
  ].some((code) => error.message.includes(code));
  if (knownNotFound || error.code === "P0002") {
    return Response.json({ error: "O registro solicitado não foi encontrado." }, {
      status: 404,
    });
  }

  for (const [code, message] of Object.entries(invalidInputMessages)) {
    if (error.message.includes(code)) {
      const conflict =
        code === "INSUFFICIENT_PRODUCT_STOCK" ||
        code === "SALE_ALREADY_CANCELLED";
      return Response.json(
        { error: message },
        { status: conflict ? 409 : 400 },
      );
    }
  }

  return null;
}

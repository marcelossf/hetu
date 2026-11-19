"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useState, useEffect } from "react";
import type { Produto } from "@/features/produtos/services/produto-service";
import { getProdutoCatalogo } from "@/features/produtos/services/produto-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type Props = { accessToken: string };

export function FichasTecnicasScreen({ accessToken }: Props) {
  const [fichas, setFichas] = useState<Produto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getProdutoCatalogo(accessToken)
      .then((data) => {
        if (active) setFichas(data.produtos);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as fichas técnicas.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-sm text-hetu-text/65">Carregando fichas técnicas...</div>
    );
  }

  return (
    <div className="space-y-6">
      <CollapsibleBlock title="Fichas técnicas cadastradas" defaultOpen={true}>
        <div className="space-y-3">
          {fichas.length === 0 ? (
            <p className="text-sm text-hetu-text/65">
              Nenhuma ficha técnica cadastrada. Crie uma nova.
            </p>
          ) : (
            <div className="space-y-2">
              {fichas.map((ficha) => (
                  <div
                    key={ficha.id_ficha}
                    className="flex items-center justify-between gap-3 rounded-lg border border-hetu-green/10 bg-hetu-cream/40 p-3"
                  >
                    <div>
                      <p className="font-medium text-hetu-text">{ficha.nome_receita}</p>
                      <p className="text-xs text-hetu-text/60">
                        Estoque: {ficha.estoque_atual} un. | R$ {ficha.preco_venda.toFixed(2)}
                      </p>
                    </div>
                    <Link
                      href={`/cadastros/fichas-tecnicas/${ficha.id_ficha}`}
                      className="rounded-lg bg-hetu-gold/20 px-3 py-1.5 text-sm font-medium text-hetu-green hover:bg-hetu-gold/30 transition"
                    >
                      Editar
                    </Link>
                  </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleBlock>

      <Link
        href="/cadastros/fichas-tecnicas/new"
        className="flex items-center justify-center gap-2 rounded-xl bg-hetu-green px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-hetu-green/90 transition"
      >
        <Plus className="h-5 w-5" />
        Nova ficha técnica
      </Link>
    </div>
  );
}

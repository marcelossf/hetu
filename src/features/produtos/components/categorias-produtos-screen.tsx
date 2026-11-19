"use client";

import { Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  getProdutoCatalogo,
  saveProdutoCategoria,
} from "@/features/produtos/services/produto-service";
import type { ProdutoCatalogo } from "@/features/produtos/services/produto-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type Props = { accessToken: string };

const emptyCatalog: ProdutoCatalogo = {
  produtos: [],
  categorias: [],
  insumos: [],
  ajustes: [],
};

const inputClass =
  "w-full rounded-lg border border-hetu-green/20 bg-white px-3 py-2 text-sm text-hetu-text placeholder:text-hetu-text/40 focus:border-hetu-gold focus:outline-none focus:ring-2 focus:ring-hetu-gold/20";

export function CategoriasProdutosScreen({ accessToken }: Props) {
  const [catalog, setCatalog] = useState<ProdutoCatalogo>(emptyCatalog);
  const [categoryName, setCategoryName] = useState("");
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refreshCatalog() {
    const updated = await getProdutoCatalogo(accessToken);
    setCatalog(updated);
  }

  useEffect(() => {
    let active = true;
    getProdutoCatalogo(accessToken)
      .then((data) => {
        if (active) setCatalog(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar as categorias.",
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

  async function submitCategory(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!categoryName.trim()) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      await saveProdutoCategoria(accessToken, {
        id_categoria: editingCategoryId,
        nome: categoryName,
      });
      setCategoryName("");
      setEditingCategoryId(null);
      setNotice(
        editingCategoryId
          ? "Categoria atualizada com sucesso!"
          : "Categoria criada com sucesso!",
      );
      await refreshCatalog();
    } catch (submitError: unknown) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Erro ao salvar categoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-sm text-hetu-text/65">Carregando categorias...</div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {notice}
        </div>
      )}

      <CollapsibleBlock
        title="Criar nova categoria"
        defaultOpen={!editingCategoryId}
      >
        <form onSubmit={submitCategory} className="space-y-4">
          <input
            type="text"
            placeholder="Nome da categoria"
            maxLength={80}
            value={categoryName}
            onChange={(e) => setCategoryName(e.currentTarget.value)}
            className={inputClass}
            required
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !categoryName.trim()}
              className="flex items-center justify-center gap-2 rounded-lg bg-hetu-green px-4 py-2 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:opacity-50 transition"
            >
              <Save className="h-4 w-4" />
              {editingCategoryId ? "Atualizar" : "Criar"}
            </button>
            {editingCategoryId && (
              <button
                type="button"
                onClick={() => {
                  setEditingCategoryId(null);
                  setCategoryName("");
                }}
                className="rounded-lg bg-hetu-cream px-3 py-2 text-sm text-hetu-text hover:bg-hetu-cream/80 transition"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </CollapsibleBlock>

      <CollapsibleBlock title="Categorias cadastradas" defaultOpen={true}>
        <div className="space-y-2">
          {catalog.categorias.length === 0 ? (
            <p className="text-sm text-hetu-text/65">Nenhuma categoria criada.</p>
          ) : (
            catalog.categorias.map((cat) => (
              <div
                key={cat.id_categoria}
                className="flex items-center justify-between gap-3 rounded-lg bg-hetu-cream/40 p-3 hover:bg-hetu-cream/60 transition"
              >
                <span className="text-sm font-medium text-hetu-text">{cat.nome}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingCategoryId(cat.id_categoria);
                    setCategoryName(cat.nome);
                  }}
                  className="rounded px-2 py-1 text-xs text-hetu-green hover:bg-hetu-gold/20 transition"
                >
                  Editar
                </button>
              </div>
            ))
          )}
        </div>
      </CollapsibleBlock>
    </div>
  );
}

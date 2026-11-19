"use client";

import { Pencil, Plus, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  normalizeCategoryName,
  toCategoryListItem,
} from "@/features/cadastros/categorias/facades/categoria-insumo-facade";
import {
  createIngredientCategory,
  getIngredientCategories,
  updateIngredientCategory,
} from "@/features/cadastros/categorias/services/categoria-insumo-service";
import type { CategoriaInsumo } from "@/features/cadastros/categorias/services/categoria-insumo-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type CategoriasInsumoScreenProps = {
  accessToken: string;
};

export function CategoriasInsumoScreen({
  accessToken,
}: CategoriasInsumoScreenProps) {
  const [categories, setCategories] = useState<CategoriaInsumo[]>([]);
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    getIngredientCategories(accessToken)
      .then((loadedCategories) => {
        if (active) setCategories(loadedCategories);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar as categorias.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  function startEditing(category: CategoriaInsumo) {
    setEditingId(category.id);
    setName(category.nome);
    setError("");
    setNotice("");
    setFormOpen(true);
    requestAnimationFrame(() => {
      document
        .getElementById("category-form-block")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelEditing() {
    setEditingId(null);
    setName("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = normalizeCategoryName(name);
    if (!normalizedName || normalizedName.length > 100) {
      setError("Informe um nome com até 100 caracteres.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");
    let saved = false;
    try {
      if (editingId === null) {
        await createIngredientCategory(accessToken, normalizedName);
        saved = true;
      } else {
        await updateIngredientCategory(accessToken, editingId, normalizedName);
        saved = true;
      }
      cancelEditing();
      setCategories(await getIngredientCategories(accessToken));
      setNotice(
        editingId === null
          ? "Categoria cadastrada."
          : "Categoria atualizada. Os insumos vinculados também foram atualizados.",
      );
    } catch (saveError) {
      setError(
        saved
          ? `A categoria foi salva, mas a lista não pôde ser atualizada: ${
              saveError instanceof Error
                ? saveError.message
                : "erro inesperado."
            }`
          : saveError instanceof Error
            ? saveError.message
            : "Não foi possível salvar a categoria.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-hetu-green">
          Categorias de insumo
        </h2>
        <p className="mt-1 text-sm text-hetu-text/70">
          Organize os insumos por tipo. Renomear uma categoria também atualiza
          os insumos associados.
        </p>
      </div>

      <CollapsibleBlock
        id="category-form-block"
        title={editingId === null ? "Cadastrar categoria" : "Editar categoria"}
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
        <label className="min-w-0 flex-1 text-sm font-medium text-hetu-text">
          {editingId === null ? "Nova categoria" : "Editar categoria"}
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
            maxLength={100}
            required
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15"
          />
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hetu-green px-4 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-wait disabled:opacity-60"
          >
            {editingId === null ? (
              <Plus aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Save aria-hidden="true" className="h-4 w-4" />
            )}
            {saving ? "Salvando..." : editingId === null ? "Adicionar" : "Salvar"}
          </button>
          {editingId !== null && (
            <button
              type="button"
              onClick={cancelEditing}
              disabled={saving}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-hetu-green/20 px-4 text-sm text-hetu-text hover:bg-hetu-cream disabled:opacity-60"
            >
              <X aria-hidden="true" className="h-4 w-4" />
              Cancelar
            </button>
          )}
        </div>
        </form>
      </CollapsibleBlock>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-xl bg-green-50 px-4 py-3 text-sm text-hetu-green">
          {notice}
        </p>
      )}

      <CollapsibleBlock
        title="Categorias cadastradas"
        open={listOpen}
        onOpenChange={setListOpen}
      >
        {loading ? (
          <p className="px-5 py-6 text-sm text-hetu-text/65" role="status">
            Carregando categorias...
          </p>
        ) : categories.length === 0 ? (
          <p className="px-5 py-6 text-sm text-hetu-text/65">
            Nenhuma categoria cadastrada.
          </p>
        ) : (
          <ul className="divide-y divide-hetu-green/10">
            {categories.map((category) => {
              const item = toCategoryListItem(category);
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-4 px-5 py-3"
                >
                  <span className="text-sm">{item.label}</span>
                  <button
                    type="button"
                    onClick={() => startEditing(category)}
                    aria-label={`Editar categoria ${item.label}`}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-hetu-green hover:bg-hetu-cream focus-visible:outline-2 focus-visible:outline-hetu-gold"
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    Editar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleBlock>
    </section>
  );
}

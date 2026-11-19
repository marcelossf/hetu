"use client";

import { Pencil, Plus, Save, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  parseDecimalInput,
  toInsumoListItem,
} from "@/features/cadastros/insumos/facades/insumo-facade";
import {
  createInsumos,
  getInsumoCatalog,
  updateInsumo,
} from "@/features/cadastros/insumos/services/insumo-service";
import type {
  CreateInsumoInput,
  Insumo,
  InsumoCatalog,
  Unidade,
} from "@/features/cadastros/insumos/services/insumo-service";
import type { CategoriaInsumo } from "@/features/cadastros/categorias/services/categoria-insumo-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

type InsumosScreenProps = {
  accessToken: string;
  onOpenCategories: () => void;
};

type InsumoForm = {
  nome: string;
  unidade: string;
  categoria: string;
  custo: string;
  estoque: string;
  ativo: "Sim" | "Não";
};

type DraftRow = {
  id: number;
  form: InsumoForm;
};

const emptyForm: InsumoForm = {
  nome: "",
  unidade: "",
  categoria: "",
  custo: "0,00",
  estoque: "0,00",
  ativo: "Sim",
};

function createEmptyForm(): InsumoForm {
  return { ...emptyForm };
}

function updateFormField(
  form: InsumoForm,
  field: keyof InsumoForm,
  value: string,
): InsumoForm {
  switch (field) {
    case "nome":
      return { ...form, nome: value };
    case "unidade":
      return { ...form, unidade: value };
    case "categoria":
      return { ...form, categoria: value };
    case "custo":
      return { ...form, custo: value };
    case "estoque":
      return { ...form, estoque: value };
    case "ativo":
      return value === "Sim" || value === "Não"
        ? { ...form, ativo: value }
        : form;
  }
}

function formatInputAmount(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

type InsumoFormFieldsProps = {
  form: InsumoForm;
  categories: CategoriaInsumo[];
  units: Unidade[];
  editing: boolean;
  onChange: (field: keyof InsumoForm, value: string) => void;
};

function InsumoFormFields({
  form,
  categories,
  units,
  editing,
  onChange,
}: InsumoFormFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm font-medium text-hetu-text">
        Nome
        <input
          type="text"
          value={form.nome}
          onChange={(event) => onChange("nome", event.currentTarget.value)}
          maxLength={120}
          required
          disabled={editing}
          autoComplete="off"
          className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15 disabled:bg-hetu-cream"
        />
      </label>

      <label className="text-sm font-medium text-hetu-text">
        Unidade
        <select
          value={form.unidade}
          onChange={(event) => onChange("unidade", event.currentTarget.value)}
          required
          className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15"
        >
          <option value="">Selecione...</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.nome}>
              {unit.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-hetu-text">
        Categoria
        <select
          value={form.categoria}
          onChange={(event) => onChange("categoria", event.currentTarget.value)}
          required
          className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15"
        >
          <option value="">Selecione...</option>
          {categories.map((category) => (
            <option key={category.id} value={category.nome}>
              {category.nome}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium text-hetu-text">
        Custo estimado unitário (R$)
        <input
          type="text"
          inputMode="decimal"
          value={form.custo}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) =>
            onChange("custo", event.currentTarget.value.replace(",", "."))
          }
          required
          disabled={editing}
          className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15 disabled:bg-hetu-cream"
        />
      </label>

      <label className="text-sm font-medium text-hetu-text">
        Estoque atual
        <input
          type="text"
          inputMode="decimal"
          value={form.estoque}
          onFocus={(event) => event.currentTarget.select()}
          onChange={(event) =>
            onChange("estoque", event.currentTarget.value.replace(",", "."))
          }
          required
          className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15"
        />
      </label>

      {editing && (
        <label className="text-sm font-medium text-hetu-text">
          Status
          <select
            value={form.ativo}
            onChange={(event) => onChange("ativo", event.currentTarget.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15"
          >
            <option value="Sim">Ativo</option>
            <option value="Não">Inativo</option>
          </select>
        </label>
      )}
    </div>
  );
}

export function InsumosScreen({
  accessToken,
  onOpenCategories,
}: InsumosScreenProps) {
  const [catalog, setCatalog] = useState<InsumoCatalog>({
    insumos: [],
    categorias: [],
    unidades: [],
  });
  const [drafts, setDrafts] = useState<DraftRow[]>([
    { id: 0, form: createEmptyForm() },
  ]);
  const [editing, setEditing] = useState<Insumo | null>(null);
  const [editForm, setEditForm] = useState<InsumoForm>(createEmptyForm);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const nextDraftId = useRef(1);

  useEffect(() => {
    let active = true;
    getInsumoCatalog(accessToken)
      .then((loadedCatalog) => {
        if (active) setCatalog(loadedCatalog);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Não foi possível carregar os insumos.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken]);

  const filteredInsumos = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    if (!term) return catalog.insumos;
    return catalog.insumos.filter((insumo) =>
      [insumo.nome, insumo.categoria ?? "", insumo.unidade]
        .join(" ")
        .toLocaleLowerCase("pt-BR")
        .includes(term),
    );
  }, [catalog.insumos, search]);

  function updateDraftField(
    id: number,
    field: keyof InsumoForm,
    value: string,
  ) {
    setDrafts((current) =>
      current.map((draft) =>
        draft.id === id
          ? { ...draft, form: updateFormField(draft.form, field, value) }
          : draft,
      ),
    );
  }

  function addDraft() {
    if (drafts.length >= 100) return;
    const id = nextDraftId.current;
    nextDraftId.current += 1;
    setDrafts((current) => [...current, { id, form: createEmptyForm() }]);
  }

  function removeDraft(id: number) {
    setDrafts((current) =>
      current.length === 1
        ? [{ ...current[0], form: createEmptyForm() }]
        : current.filter((draft) => draft.id !== id),
    );
  }

  function startEditing(insumo: Insumo) {
    setEditing(insumo);
    setEditForm({
      nome: insumo.nome,
      unidade: insumo.unidade,
      categoria: insumo.categoria ?? "",
      custo: formatInputAmount(insumo.custo_estimado_unitario),
      estoque: formatInputAmount(insumo.estoque_atual),
      ativo: insumo.ativo,
    });
    setError("");
    setNotice("");
    setFormOpen(true);
    requestAnimationFrame(() => {
      document
        .getElementById("insumo-form-block")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function cancelEditing() {
    setEditing(null);
    setEditForm(createEmptyForm());
  }

  function resetDrafts() {
    const id = nextDraftId.current;
    nextDraftId.current += 1;
    setDrafts([{ id, form: createEmptyForm() }]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    let saved = false;

    try {
      if (editing) {
        const estoque = parseDecimalInput(editForm.estoque);
        if (estoque === null || !editForm.unidade || !editForm.categoria) {
          setError("Informe estoque, unidade e categoria válidos.");
          return;
        }

        await updateInsumo(accessToken, {
          id_insumo: editing.id_insumo,
          unidade: editForm.unidade,
          categoria: editForm.categoria,
          estoqueAtual: estoque,
          ativo: editForm.ativo,
        });
        saved = true;
        setEditing(null);
        setNotice("Insumo atualizado.");
      } else {
        const insumos: CreateInsumoInput[] = [];
        for (const [index, draft] of drafts.entries()) {
          const nome = draft.form.nome.trim().replace(/\s+/g, " ");
          const custo = parseDecimalInput(draft.form.custo);
          const estoque = parseDecimalInput(draft.form.estoque);
          if (
            !nome ||
            nome.length > 120 ||
            custo === null ||
            estoque === null ||
            !draft.form.unidade ||
            !draft.form.categoria
          ) {
            setError(`Verifique os campos do insumo ${index + 1}.`);
            return;
          }
          insumos.push({
            nome,
            unidade: draft.form.unidade,
            categoria: draft.form.categoria,
            custoEstimadoUnitario: custo,
            estoqueAtual: estoque,
          });
        }

        await createInsumos(accessToken, insumos);
        saved = true;
        resetDrafts();
        setNotice(
          `${insumos.length} insumo${insumos.length === 1 ? "" : "s"} cadastrado${insumos.length === 1 ? "" : "s"}.`,
        );
      }

      setCatalog(await getInsumoCatalog(accessToken));
    } catch (saveError) {
      setError(
        saved
          ? `O insumo foi salvo, mas a lista não pôde ser atualizada: ${
              saveError instanceof Error
                ? saveError.message
                : "erro inesperado."
            }`
          : saveError instanceof Error
            ? saveError.message
            : "Não foi possível salvar o insumo.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="font-serif text-xl text-hetu-green">Insumos</h2>
        <p className="mt-1 text-sm text-hetu-text/70">
          Cadastre matérias-primas, unidades, custos estimados e estoque.
        </p>
      </div>

      <CollapsibleBlock
        id="insumo-form-block"
        title={editing ? "Editar insumo" : "Cadastrar insumos"}
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex justify-end">
          {editing ? (
            <p className="text-xs text-hetu-text/60">
              Nome e custo inicial são preservados; o custo é atualizado pelo
              histórico de compras.
            </p>
          ) : (
            <p className="text-xs text-hetu-text/60">
              Você pode cadastrar até 100 itens no mesmo lote.
            </p>
          )}
        </div>

        {editing ? (
          <InsumoFormFields
            form={editForm}
            categories={catalog.categorias}
            units={catalog.unidades}
            editing
            onChange={(field, value) =>
              setEditForm((current) => updateFormField(current, field, value))
            }
          />
        ) : (
          <div className="space-y-3">
            {drafts.map((draft, index) => (
              <div
                key={draft.id}
                className="space-y-4 rounded-xl border border-hetu-green/10 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-medium text-hetu-green">
                    Insumo {index + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeDraft(draft.id)}
                    aria-label={`Remover insumo ${index + 1} do lote`}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg px-2 text-sm text-red-700 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600"
                  >
                    <Trash2 aria-hidden="true" className="h-4 w-4" />
                    Remover
                  </button>
                </div>
                <InsumoFormFields
                  form={draft.form}
                  categories={catalog.categorias}
                  units={catalog.unidades}
                  editing={false}
                  onChange={(field, value) =>
                    updateDraftField(draft.id, field, value)
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addDraft}
              disabled={drafts.length >= 100}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-hetu-green hover:bg-hetu-cream disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              Adicionar outro insumo
            </button>
          </div>
        )}

        {(catalog.categorias.length === 0 || catalog.unidades.length === 0) && (
          <div className="flex flex-col gap-2 rounded-xl bg-hetu-cream p-4 text-sm text-hetu-text/75 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {catalog.categorias.length === 0
                ? "Cadastre uma categoria antes de incluir insumos."
                : "Não há unidades disponíveis para seleção."}
            </span>
            {catalog.categorias.length === 0 && (
              <button
                type="button"
                onClick={onOpenCategories}
                className="self-start font-medium text-hetu-green underline underline-offset-2"
              >
                Abrir categorias
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={
              saving ||
              catalog.categorias.length === 0 ||
              catalog.unidades.length === 0
            }
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-hetu-green px-4 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {editing ? (
              <Save aria-hidden="true" className="h-4 w-4" />
            ) : (
              <Plus aria-hidden="true" className="h-4 w-4" />
            )}
            {saving
              ? "Salvando..."
              : editing
                ? "Salvar alterações"
                : `Cadastrar ${drafts.length === 1 ? "insumo" : "lote"}`}
          </button>
          {editing && (
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
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-xl bg-green-50 px-4 py-3 text-sm text-hetu-green"
        >
          {notice}
        </p>
      )}

      <CollapsibleBlock
        title="Insumos cadastrados"
        open={listOpen}
        onOpenChange={setListOpen}
      >
        <div className="overflow-hidden">
        <div className="flex flex-col gap-3 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm text-hetu-text/70">
            Buscar
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Nome, categoria ou unidade"
              className="mt-1 min-h-10 w-full rounded-lg border border-hetu-green/20 px-3 text-sm outline-none focus:border-hetu-green sm:w-64"
            />
          </label>
          </div>
        {loading ? (
          <p className="px-5 py-6 text-sm text-hetu-text/65" role="status">
            Carregando insumos...
          </p>
        ) : filteredInsumos.length === 0 ? (
          <p className="px-5 py-6 text-sm text-hetu-text/65">
            {search
              ? "Nenhum insumo corresponde à busca."
              : "Nenhum insumo cadastrado."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-hetu-cream/70 text-xs uppercase tracking-wide text-hetu-text/65">
                <tr>
                  <th className="px-5 py-3 font-medium">Insumo</th>
                  <th className="px-4 py-3 font-medium">Categoria</th>
                  <th className="px-4 py-3 font-medium">Unidade</th>
                  <th className="px-4 py-3 text-right font-medium">
                    Custo unitário
                  </th>
                  <th className="px-4 py-3 text-right font-medium">Estoque</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hetu-green/10">
                {filteredInsumos.map((insumo) => {
                  const item = toInsumoListItem(insumo);
                  return (
                    <tr key={item.id_insumo}>
                      <td className="px-5 py-3 font-medium text-hetu-text">
                        {item.nome}
                      </td>
                      <td className="px-4 py-3 text-hetu-text/70">
                        {item.categoria ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-hetu-text/70">
                        {item.unidade}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.custoFormatado}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {item.estoqueFormatado}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            item.ativo === "Sim"
                              ? "bg-green-50 text-hetu-green"
                              : "bg-hetu-cream text-hetu-text/60"
                          }`}
                        >
                          {item.ativo === "Sim" ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => startEditing(insumo)}
                          aria-label={`Editar insumo ${item.nome}`}
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-hetu-green hover:bg-hetu-cream focus-visible:outline-2 focus-visible:outline-hetu-gold"
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        </div>
      </CollapsibleBlock>
    </section>
  );
}

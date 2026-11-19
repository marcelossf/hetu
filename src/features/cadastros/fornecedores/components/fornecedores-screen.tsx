"use client";

import { Pencil, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  deleteFornecedor,
  getFornecedores,
  saveFornecedor,
} from "@/features/cadastros/fornecedores/services/fornecedor-service";
import type { Fornecedor } from "@/features/cadastros/fornecedores/services/fornecedor-service";
import { CollapsibleBlock } from "@/lib/components/collapsible-block";

const emptyForm = () => ({
  id_fornecedor: undefined as number | undefined,
  nome: "",
  endereco: "",
  ativo: "Sim" as "Sim" | "Não",
});

export function FornecedoresScreen({ accessToken }: { accessToken: string }) {
  const [suppliers, setSuppliers] = useState<Fornecedor[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setSuppliers(await getFornecedores(accessToken));
  }

  useEffect(() => {
    let active = true;
    getFornecedores(accessToken)
      .then((loadedSuppliers) => {
        if (active) setSuppliers(loadedSuppliers);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os fornecedores.",
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

  function editSupplier(supplier: Fornecedor) {
    setForm({
      id_fornecedor: supplier.id_fornecedor,
      nome: supplier.nome,
      endereco: supplier.endereco ?? "",
      ativo: supplier.ativo,
    });
    setFormOpen(true);
    setError("");
    setNotice("");
    requestAnimationFrame(() => {
      document
        .getElementById("supplier-form")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveFornecedor(accessToken, {
        ...form,
        endereco: form.endereco.trim() || null,
      });
      await refresh();
      setForm(emptyForm());
      setNotice(
        form.id_fornecedor
          ? "Fornecedor atualizado."
          : "Fornecedor cadastrado.",
      );
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o fornecedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(supplier: Fornecedor) {
    if (
      !window.confirm(
        `Desativar o fornecedor ${supplier.nome}? O histórico continuará preservado.`,
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await deleteFornecedor(accessToken, supplier.id_fornecedor);
      await refresh();
      setNotice("Fornecedor desativado.");
    } catch (deleteError: unknown) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Não foi possível desativar o fornecedor.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
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
        id="supplier-form"
        title={form.id_fornecedor ? "Editar fornecedor" : "Cadastrar fornecedor"}
        open={formOpen}
        onOpenChange={setFormOpen}
      >
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-hetu-text">
            Nome
            <input
              required
              maxLength={120}
              value={form.nome}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  nome: event.currentTarget.value,
                }))
              }
              className={inputClass}
            />
          </label>
          <label className="text-sm font-medium text-hetu-text">
            Endereço ou referência
            <input
              maxLength={300}
              value={form.endereco}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  endereco: event.currentTarget.value,
                }))
              }
              className={inputClass}
            />
          </label>
          {form.id_fornecedor && (
            <label className="text-sm font-medium text-hetu-text">
              Status
              <select
                value={form.ativo}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ativo:
                      event.currentTarget.value === "Não" ? "Não" : "Sim",
                  }))
                }
                className={inputClass}
              >
                <option value="Sim">Ativo</option>
                <option value="Não">Inativo</option>
              </select>
            </label>
          )}
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white disabled:opacity-60"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar fornecedor"}
            </button>
            {form.id_fornecedor && (
              <button
                type="button"
                onClick={() => setForm(emptyForm())}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-hetu-green/20 px-4 text-sm text-hetu-green"
              >
                <X aria-hidden="true" className="h-4 w-4" />
                Cancelar
              </button>
            )}
          </div>
        </form>
      </CollapsibleBlock>

      <CollapsibleBlock
        title="Fornecedores cadastrados"
        open={listOpen}
        onOpenChange={setListOpen}
      >
        {loading ? (
          <p className="text-sm text-hetu-text/65">Carregando fornecedores...</p>
        ) : suppliers.length === 0 ? (
          <p className="text-sm text-hetu-text/65">Nenhum fornecedor cadastrado.</p>
        ) : (
          <ul className="divide-y divide-hetu-green/10">
            {suppliers.map((supplier) => (
              <li
                key={supplier.id_fornecedor}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-hetu-text">{supplier.nome}</p>
                  <p className="text-sm text-hetu-text/60">
                    {supplier.ativo === "Sim" ? "Ativo" : "Inativo"}
                    {supplier.endereco ? ` · ${supplier.endereco}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => editSupplier(supplier)}
                    className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-hetu-green hover:bg-hetu-cream"
                  >
                    <Pencil aria-hidden="true" className="h-4 w-4" />
                    Editar
                  </button>
                  {supplier.ativo === "Sim" && (
                    <button
                      type="button"
                      onClick={() => void deactivate(supplier)}
                      disabled={saving}
                      className="min-h-10 rounded-lg px-3 text-sm text-red-700 hover:bg-red-50 disabled:opacity-60"
                    >
                      Desativar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleBlock>
    </div>
  );
}

const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

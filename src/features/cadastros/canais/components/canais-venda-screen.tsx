"use client";

import { Pencil, Save } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import {
  getCanaisVenda,
  saveCanalVenda,
} from "@/features/cadastros/canais/services/canal-service";
import type { CanalVenda } from "@/features/cadastros/canais/services/canal-service";

type ChannelForm = {
  id?: number;
  nome: string;
  endereco: string;
  ativo: "Sim" | "Não";
};

const emptyForm = (): ChannelForm => ({
  nome: "",
  endereco: "",
  ativo: "Sim",
});
const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-hetu-green/20 bg-white px-3 text-sm outline-none focus:border-hetu-green focus:ring-2 focus:ring-hetu-green/15";

export function CanaisVendaScreen({ accessToken }: { accessToken: string }) {
  const [channels, setChannels] = useState<CanalVenda[]>([]);
  const [form, setForm] = useState<ChannelForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh() {
    setChannels(await getCanaisVenda(accessToken));
  }

  useEffect(() => {
    let active = true;
    getCanaisVenda(accessToken)
      .then((data) => {
        if (active) setChannels(data);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Não foi possível carregar os canais.",
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await saveCanalVenda(accessToken, form);
      await refresh();
      setForm(emptyForm());
      setNotice("Canal de venda salvo.");
    } catch (saveError: unknown) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Não foi possível salvar o canal.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {error && <Notice kind="error" message={error} />}
      {notice && <Notice kind="success" message={notice} />}
      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">
          {form.id ? "Editar canal de venda" : "Novo canal de venda"}
        </h2>
        <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-hetu-text">
            Nome
            <input
              required
              maxLength={100}
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
            Endereço ou referência (opcional)
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
          {form.id && (
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
          <div className="flex items-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-hetu-green px-5 text-sm font-medium text-white hover:bg-hetu-green/90 disabled:opacity-60"
            >
              <Save aria-hidden="true" className="h-4 w-4" />
              {saving ? "Salvando..." : "Salvar canal"}
            </button>
            {form.id && (
              <button
                type="button"
                onClick={() => setForm(emptyForm())}
                className="min-h-11 rounded-xl border border-hetu-green/20 px-4 text-sm text-hetu-green"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-hetu-green/10 bg-white p-5 shadow-sm sm:p-7">
        <h2 className="font-serif text-xl text-hetu-green">
          Canais cadastrados
        </h2>
        {loading ? (
          <p className="mt-4 text-sm text-hetu-text/65" role="status">
            Carregando canais...
          </p>
        ) : channels.length === 0 ? (
          <p className="mt-4 text-sm text-hetu-text/65">
            Nenhum canal cadastrado.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-hetu-green/10">
            {channels.map((channel) => (
              <li
                key={channel.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-medium text-hetu-text">{channel.nome}</p>
                  <p className="text-sm text-hetu-text/60">
                    {channel.ativo === "Sim" ? "Ativo" : "Inativo"}
                    {channel.endereco ? ` · ${channel.endereco}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setForm({
                      id: channel.id,
                      nome: channel.nome,
                      endereco: channel.endereco ?? "",
                      ativo: channel.ativo,
                    })
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm text-hetu-green hover:bg-hetu-cream"
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  Editar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Notice({
  kind,
  message,
}: {
  kind: "error" | "success";
  message: string;
}) {
  return (
    <p
      role={kind === "error" ? "alert" : "status"}
      className={`rounded-xl border px-4 py-3 text-sm ${
        kind === "error"
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      {message}
    </p>
  );
}

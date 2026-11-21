import assert from "node:assert/strict";
import test from "node:test";
import { isDateOnly } from "../src/lib/date-only.ts";
import {
  formatVendaDate,
  vendaDateFromTimestamp,
} from "../src/features/vendas/facades/venda-facade.ts";

test("valida datas reais e o formato usado na venda", () => {
  assert.equal(isDateOnly("2024-02-29"), true);
  assert.equal(isDateOnly("2025-02-29"), false);
  assert.equal(isDateOnly("2026-04-31"), false);
  assert.equal(isDateOnly("0099-12-31"), false);
  assert.equal(isDateOnly("0100-01-01"), true);
  assert.equal(isDateOnly("21/11/2026"), false);
  assert.equal(isDateOnly(null), false);
});

test("interpreta o dia da venda no mesmo UTC-3 dos relatórios", () => {
  assert.equal(vendaDateFromTimestamp("2026-11-22T02:30:00Z"), "2026-11-21");
  assert.equal(formatVendaDate("2026-11-21T15:00:00Z"), "21/11/2026");
  assert.equal(vendaDateFromTimestamp("2026-11-21T03:00:00Z"), "2026-11-21");
});

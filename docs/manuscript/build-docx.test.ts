import { describe, expect, test } from "bun:test";
import { widenTables } from "./build-docx";

// The grids below are the ones pandoc 3.9 wrote for Table 3 and Table 2 of mitoage2.md (round v0.2).
const table3 = [1388, 816, 816, 816, 816, 816, 816, 816, 816];
const table2 = [1377, 5681, 860];
const grid = (ws: number[]) => `<w:tblGrid>${ws.map((w) => `<w:gridCol w:w="${w}" />`).join("")}</w:tblGrid>`;
const widths = (xml: string) =>
  [...xml.matchAll(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/g)].map((m) =>
    [...m[1].matchAll(/w:w="(\d+)"/g)].map((x) => Number(x[1])),
  );

describe("widenTables", () => {
  const doc = `<w:body><w:tbl>${grid(table3)}</w:tbl><w:p/><w:tbl>${grid(table2)}</w:tbl></w:body>`;
  const { xml, tables } = widenTables(doc, 9360);
  const out = widths(xml);

  test("every table is scaled to the text width, within rounding", () => {
    expect(tables).toBe(2);
    for (const ws of out) {
      const total = ws.reduce((a, b) => a + b, 0);
      expect(total).toBeLessThanOrEqual(9360);
      expect(9360 - total).toBeLessThan(ws.length);
    }
  });

  test("the proportions the separator line gave are kept", () => {
    [table3, table2].forEach((before, i) => {
      const ratioBefore = before[0] / before[1];
      const ratioAfter = out[i][0] / out[i][1];
      expect(Math.abs(ratioAfter - ratioBefore)).toBeLessThan(0.01);
      expect(out[i].length).toBe(before.length);
    });
  });

  test("text outside the grids is untouched, and a document without tables passes through", () => {
    expect(xml.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/g, "")).toBe(
      doc.replace(/<w:tblGrid>[\s\S]*?<\/w:tblGrid>/g, ""),
    );
    expect(widenTables("<w:body><w:p/></w:body>")).toEqual({ xml: "<w:body><w:p/></w:body>", tables: 0 });
  });
});

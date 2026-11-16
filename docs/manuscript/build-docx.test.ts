import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { shrinkTableText, widenTables } from "./build-docx";

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

describe("shrinkTableText", () => {
  const runsIn = (xml: string) => [...xml.matchAll(/<w:r>[\s\S]*?<\/w:r>/g)].map((m) => m[0]);
  const size = (run: string) => /<w:sz w:val="(\d+)"/.exec(run)?.[1] ?? null;

  test("every run inside a table gets the table size, and runs outside keep theirs", () => {
    const doc =
      `<w:p><w:r><w:t>before</w:t></w:r></w:p>` +
      `<w:tbl><w:tr><w:tc><w:p><w:pPr><w:pStyle w:val="Compact" /></w:pPr><w:r><w:t>2,211</w:t></w:r></w:p></w:tc>` +
      `<w:tc><w:p><w:r><w:rPr><w:b /><w:sz w:val="24" /></w:rPr><w:t>15,906</w:t></w:r></w:p></w:tc></w:tr></w:tbl>` +
      `<w:p><w:r><w:rPr><w:i /></w:rPr><w:t>after</w:t></w:r></w:p>`;
    const { xml, runs } = shrinkTableText(doc, 18);
    const all = runsIn(xml);
    expect(runs).toBe(2);
    expect(all.map(size)).toEqual([null, "18", "18", null]);
    // An existing size is replaced, not doubled, and bold is kept.
    expect(all[2]!.match(/<w:sz /g)).toHaveLength(1);
    expect(all[2]).toContain("<w:b />");
    // The paragraph mark inside the table is sized too, so empty cells do not keep the body's line height.
    expect(xml).toContain(`<w:pPr><w:pStyle w:val="Compact" /><w:rPr><w:sz w:val="18" /><w:szCs w:val="18" /></w:rPr></w:pPr>`);
    expect(xml.slice(xml.indexOf("</w:tbl>"))).toBe(doc.slice(doc.indexOf("</w:tbl>")));
  });

  test("the size goes before the elements the schema puts after it", () => {
    const doc = `<w:tbl><w:r><w:rPr><w:b /><w:vertAlign w:val="superscript" /></w:rPr><w:t>5</w:t></w:r></w:tbl>`;
    const { xml } = shrinkTableText(doc, 18);
    expect(xml).toContain(`<w:rPr><w:b /><w:sz w:val="18" /><w:szCs w:val="18" /><w:vertAlign w:val="superscript" /></w:rPr>`);
  });

  const pandoc = process.env.PANDOC ?? Bun.which("pandoc");
  test.skipIf(!pandoc)("on pandoc's own output, every table run is sized and no other run is", () => {
    const dir = mkdtempSync(join(tmpdir(), "shrink-test-"));
    try {
      writeFileSync(join(dir, "t.md"), "Some *body* text.\n\n| Scope | Species | Tests |\n|---------|------:|------:|\n| All species | 2,211 | 1,414 |\n| **All scopes** | | **15,906** |\n\nAfter the table.\n");
      Bun.spawnSync([pandoc!, join(dir, "t.md"), "-o", join(dir, "t.docx")]);
      Bun.spawnSync(["unzip", "-q", "-o", join(dir, "t.docx"), "word/document.xml", "-d", dir]);
      const before = readFileSync(join(dir, "word", "document.xml"), "utf8");
      const { xml, runs } = shrinkTableText(before, 18);
      const table = /<w:tbl>[\s\S]*?<\/w:tbl>/.exec(xml)![0];
      const tableRuns = runsIn(table);
      expect(runs).toBe(tableRuns.length);
      expect(tableRuns.length).toBeGreaterThanOrEqual(8);
      expect(tableRuns.every((r) => size(r) === "18")).toBe(true);
      const outside = xml.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, "");
      expect(outside).toBe(before.replace(/<w:tbl>[\s\S]*?<\/w:tbl>/g, ""));
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

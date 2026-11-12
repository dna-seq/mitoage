/** Labels and formatters for life-history traits (Species.traits). Safe for islands. */
import type { Traits } from "~/data/schema";
import { fmtDays, fmtKelvinAsCelsius, fmtMass, fmtNum } from "./format";

type TraitField = Exclude<keyof Traits, "source">;

export interface TraitDef {
  key: TraitField;
  label: string;
  format: (v: number) => string;
}

export const TRAIT_DEFS: readonly TraitDef[] = [
  { key: "adultWeightG", label: "Adult weight", format: fmtMass },
  { key: "birthWeightG", label: "Birth weight", format: fmtMass },
  { key: "metabolicRateW", label: "Basal metabolic rate", format: (v) => `${fmtNum(v, 3)} W` },
  { key: "bodyTemperatureK", label: "Body temperature", format: fmtKelvinAsCelsius },
  { key: "femaleMaturityDays", label: "Female sexual maturity", format: fmtDays },
  { key: "maleMaturityDays", label: "Male sexual maturity", format: fmtDays },
  { key: "gestationDays", label: "Gestation or incubation", format: fmtDays },
  { key: "litterSize", label: "Litter or clutch size", format: (v) => fmtNum(v, 1) },
  { key: "littersPerYear", label: "Litters per year", format: (v) => fmtNum(v, 1) },
  { key: "growthRatePerDay", label: "Postnatal growth rate", format: (v) => `${fmtNum(v, 4)} per day` },
];

/** Non-null traits of a species, ready to render. */
export const presentTraits = (traits: Traits): { label: string; value: string }[] =>
  TRAIT_DEFS.flatMap((d) => {
    const v = traits[d.key];
    return v === null || !Number.isFinite(v) ? [] : [{ label: d.label, value: d.format(v) }];
  });

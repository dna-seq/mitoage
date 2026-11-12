/**
 * Display names and colours for taxonomic classes. Colours are CSS custom properties
 * from tokens.css, so they follow the theme. Safe to import from islands.
 */

export interface ClassStyle {
  /** Plain-English label, e.g. "Ray-finned fishes". */
  label: string;
  /** CSS colour value, e.g. "var(--class-mammalia)". */
  color: string;
}

const CLASS_STYLES: Record<string, ClassStyle> = {
  Mammalia: { label: "Mammals", color: "var(--class-mammalia)" },
  Aves: { label: "Birds", color: "var(--class-aves)" },
  Actinopterygii: { label: "Ray-finned fishes", color: "var(--class-actinopterygii)" },
  Reptilia: { label: "Reptiles", color: "var(--class-reptilia)" },
  Chondrichthyes: { label: "Sharks and rays", color: "var(--class-chondrichthyes)" },
  Amphibia: { label: "Amphibians", color: "var(--class-amphibia)" },
  Sarcopterygii: { label: "Lobe-finned fishes", color: "var(--class-other)" },
  Cephalaspidomorphi: { label: "Lampreys", color: "var(--class-other)" },
  Insecta: { label: "Insects", color: "var(--class-other)" },
  Malacostraca: { label: "Crustaceans", color: "var(--class-other)" },
  Echinoidea: { label: "Sea urchins", color: "var(--class-other)" },
  Chromadorea: { label: "Roundworms", color: "var(--class-other)" },
  Bivalvia: { label: "Bivalves", color: "var(--class-other)" },
};

/** Classes with their own colour; everything else is grouped as "Other" in charts. */
export const COLOURED_CLASSES = [
  "Mammalia",
  "Aves",
  "Actinopterygii",
  "Reptilia",
  "Chondrichthyes",
  "Amphibia",
] as const;

export const OTHER_GROUP = "Other";

export const classStyle = (className: string): ClassStyle =>
  CLASS_STYLES[className] ?? { label: className, color: "var(--class-other)" };

export const classLabel = (className: string): string => classStyle(className).label;

export const classColor = (className: string): string => classStyle(className).color;

/** Chart group for a class: its own name if coloured, else "Other". */
export const classGroup = (className: string): string =>
  (COLOURED_CLASSES as readonly string[]).includes(className) ? className : OTHER_GROUP;

/** Legend definitions for scatter plots coloured by class. */
export const CLASS_GROUPS: { key: string; label: string; color: string }[] = [
  ...COLOURED_CLASSES.map((c) => ({ key: c, label: classLabel(c), color: classColor(c) })),
  { key: OTHER_GROUP, label: "Other classes", color: "var(--class-other)" },
];

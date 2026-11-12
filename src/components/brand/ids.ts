/** Per-build counter for SVG ids, so several marks can share a page without id clashes. */
let counter = 0;
export const nextId = (prefix: string): string => `${prefix}-${(counter++).toString(36)}`;

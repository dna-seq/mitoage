/**
 * How much the fluid UI scale has grown: the root font size divided by 16px (1 on most screens,
 * up to 1.5 on very wide ones, see `html` in src/styles/global.css; also follows the reader's
 * browser font-size setting). Browser only.
 *
 * Chart islands whose viewBox follows their rendered width divide that width by this factor, so
 * text, markers and margins (in viewBox units) grow with the rest of the interface.
 */
export const uiScale = (): number => {
  const px = Number.parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(px) && px > 0 ? px / 16 : 1;
};

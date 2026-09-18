/**
 * Geometry shared by the logo and the gauge: a half dial whose value runs 0 → 100 from left to
 * right. Angles are in degrees, 180 at the left end and 0 at the right, like a unit circle.
 */

export function valueToAngle(value: number): number {
  return 180 - (Math.min(100, Math.max(0, value)) / 100) * 180;
}

/** Rotation for a needle drawn pointing straight up (value 50). */
export function needleRotation(value: number): number {
  return 90 - valueToAngle(value);
}

export function polar(cx: number, cy: number, r: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [round(cx + r * Math.cos(rad)), round(cy - r * Math.sin(rad))];
}

/** SVG path for an arc drawn clockwise from `from` to `to` (from > to). */
export function arcPath(cx: number, cy: number, r: number, from: number, to: number): string {
  const [x1, y1] = polar(cx, cy, r, from);
  const [x2, y2] = polar(cx, cy, r, to);
  const large = from - to > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

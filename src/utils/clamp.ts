/**
 * value を [min, max] の範囲へ収める。
 *
 * - `NaN` は `min` として扱う（不正な入力でページ位置を壊さないため / FR-16）
 * - `max` が `min` より小さい場合は `min` を返す
 */
export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) {
    return min;
  }
  if (max < min) {
    return min;
  }
  if (value < min) {
    return min;
  }
  if (value > max) {
    return max;
  }
  return value;
}

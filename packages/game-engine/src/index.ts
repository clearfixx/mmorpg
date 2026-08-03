export interface RandomSource {
  next(): number
  int(min: number, max: number): number
}

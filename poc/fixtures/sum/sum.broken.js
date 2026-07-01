// Deliberately broken: subtracts instead of adds. The probe restores sum.js
// from this file before every run, so the loop always starts from red.
export function sum(a, b) {
  return a - b;
}

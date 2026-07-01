// Broken: subtracts instead of adds. fa(2, 3) should be 5. The probe restores ma.js
// from this stub before every run, so the slice always starts from red.
export function fa(a, b) {
  return a - b;
}

// Broken stub for the THIRD slice. The slice's groundedness depends on which test runs:
//   multi.test.js     fc(4) is asserted BOTH true AND false — UNSATISFIABLE by construction.
//                     No implementation can close this slice (the ungrounded-child case).
//   multi-ok.test.js  fc(4) === 8 (double) — satisfiable; a worker CAN close it (the control).
export function fc(n) {
  return n;
}

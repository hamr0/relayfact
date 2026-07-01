// Broken: returns n unchanged. In multi-ok the spec is fc(4) === 8 (double) — satisfiable; a worker
// closes this slice by returning n * 2. Restored from this stub each run.
export function fc(n) {
  return n;
}

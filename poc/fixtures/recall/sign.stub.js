// Stub — the worker must replace this so `node --test sign.test.js` passes.
// The required return value is an ARBITRARY project convention (not derivable from code):
// it lives ONLY in (a) the test file (which the worker cannot read — no read tool) and
// (b) the litectx memory store (reachable only via recall — the ON arm). See probe-06.
export function sign() {
  return 'TODO';
}

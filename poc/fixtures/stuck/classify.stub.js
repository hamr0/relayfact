// A reasonable first attempt that passes the first assertion and fails the second.
// It is genuinely red, and no edit to THIS file can make the contradictory test pass.
export function classify(n) {
  return n % 2 === 0 ? 'even' : 'odd';
}

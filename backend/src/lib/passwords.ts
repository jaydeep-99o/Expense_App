// Simple, strong temp password generator with enforced complexity.
export function generateTempPassword(len = 12): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';     // no I/O to avoid confusion
  const lower = 'abcdefghijkmnpqrstuvwxyz';     // no l
  const nums  = '23456789';                     // no 0/1
  const syms  = '!@#$%^&*';
  const all   = upper + lower + nums + syms;

  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];

  // ensure at least one of each class
  const base = [pick(upper), pick(lower), pick(nums), pick(syms)];
  for (let i = base.length; i < len; i++) base.push(pick(all));

  // Fisher–Yates shuffle
  for (let i = base.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [base[i], base[j]] = [base[j], base[i]];
  }
  return base.join('');
}

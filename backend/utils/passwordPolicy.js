/**
 * utils/passwordPolicy.js
 *
 * Password strength rules shared by registration, reset and change-password.
 * Rules: 8–128 characters, at least one letter and one digit, not a very
 * common password, and must not contain the part of the e-mail before "@".
 */

const COMMON = new Set([
  'password', 'password1', 'password123', '12345678', '123456789', '1234567890', 'qwertyui',
  'qwerty123', 'iloveyou', 'admin123', 'welcome1', 'welcome123', 'letmein123', 'abc12345',
  'sakhiai123', 'sakhi1234', 'india123', 'password@123', 'test1234', 'passw0rd',
]);

/**
 * @param {string} password
 * @param {{ email?: string, name?: string }} [context]
 * @returns {string[]} list of problems (empty array when acceptable)
 */
export function validatePassword(password, context = {}) {
  const problems = [];
  if (typeof password !== 'string') return ['Password is required.'];

  if (password.length < 8) problems.push('Password must be at least 8 characters long.');
  if (password.length > 128) problems.push('Password must be at most 128 characters long.');
  if (!/[A-Za-z]/.test(password)) problems.push('Password must contain at least one letter.');
  if (!/\d/.test(password)) problems.push('Password must contain at least one number.');
  if (COMMON.has(password.toLowerCase())) problems.push('That password is too common. Please choose another.');

  const local = (context.email || '').split('@')[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    problems.push('Password must not contain your e-mail name.');
  }
  return problems;
}

export default { validatePassword };

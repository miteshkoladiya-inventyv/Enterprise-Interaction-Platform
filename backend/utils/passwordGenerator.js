import crypto from "crypto";

// Generate a temporary password
export const generateTempPassword = (length = 12) => {
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const symbols = "!@#$%^&*";

  const allChars = lowercase + uppercase + numbers + symbols;

  let password = "";

  // Ensure at least one character from each set
  password += lowercase[crypto.randomInt(0, lowercase.length)];
  password += uppercase[crypto.randomInt(0, uppercase.length)];
  password += numbers[crypto.randomInt(0, numbers.length)];
  password += symbols[crypto.randomInt(0, symbols.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += allChars[crypto.randomInt(0, allChars.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => crypto.randomInt(-1, 2))
    .join("");
};

// Generate a simple password (easier to remember)
export const generateSimplePassword = () => {
  const adjectives = ["Quick", "Bright", "Swift", "Happy", "Cool", "Smart"];
  const nouns = ["Tiger", "Eagle", "Lion", "Falcon", "Wolf", "Bear"];
  const numbers = crypto.randomInt(100, 999);
  const symbols = ["!", "@", "#", "$"];

  const adjective = adjectives[crypto.randomInt(0, adjectives.length)];
  const noun = nouns[crypto.randomInt(0, nouns.length)];
  const symbol = symbols[crypto.randomInt(0, symbols.length)];

  return `${adjective}${noun}${numbers}${symbol}`;
};

// Validate password strength
export const validatePasswordStrength = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  const strength = {
    isValid:
      password.length >= minLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers,
    length: password.length >= minLength,
    hasUpperCase,
    hasLowerCase,
    hasNumbers,
    hasSpecialChar,
    score: 0,
  };

  // Calculate strength score (0-5)
  if (strength.length) strength.score++;
  if (hasUpperCase) strength.score++;
  if (hasLowerCase) strength.score++;
  if (hasNumbers) strength.score++;
  if (hasSpecialChar) strength.score++;

  return strength;
};

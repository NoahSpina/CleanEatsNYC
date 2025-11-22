// Basic string check + trim
export function checkAndTrimString(str, name = "value") {
  if (typeof str !== "string") throw new Error(`Error: ${name} must be a string`);
  str = str.trim();
  if (!str) throw new Error(`Error: ${name} cannot be empty`);
  return str;
}

// Convert date or null
export const toDateorNull = (str) => {
  if (!str) return null;
  const d = new Date(str);
  return isNaN(d) ? null : d;
};

// Number validator
export function checkNumber(num, name) {
  if (typeof num !== "number" || !isFinite(num))
    throw new Error(`Error: Invalid ${name}`);
  return num;
}

// Email validation
export function validateEmail(email) {
  email = checkAndTrimString(email, "email");
  if (email.length > 254) throw new Error("Error: Email too long");

  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) throw new Error("Error: Invalid email");

  return email.toLowerCase();
}

// Password validation
export function validatePassword(password) {
  password = checkAndTrimString(password, "password");

  if (password.length < 6) throw new Error("Error: Password too short");
  if (password.length > 128) throw new Error("Error: Password too long");

  if (!/[a-zA-Z]/.test(password)) throw new Error("Error: Must include a letter");
  if (!/[0-9]/.test(password)) throw new Error("Error: Must include a number");

  return password;
}

// Matching password validation
export function validatePasswordMatch(password, confirm) {
  password = checkAndTrimString(password, "password");
  confirm = checkAndTrimString(confirm, "confirm password");
  if (password !== confirm) throw new Error("Error: Passwords do not match");
  return true;
}

// Username validation
export function validateUsername(username) {
  username = checkAndTrimString(username, "username");

  if (username.length < 3) throw new Error("Error: Username too short");
  if (username.length > 20) throw new Error("Error: Username too long");
  if (!/^[a-zA-Z0-9_]+$/.test(username))
    throw new Error("Error: Invalid username");
  if (/^\d/.test(username))
    throw new Error("Error: Username cannot start with number");

  return username.toLowerCase();
}

// Display name validation
export function validateDisplayName(name) {
  name = checkAndTrimString(name, "display name");

  if (name.length < 2) throw new Error("Error: Display name too short");
  if (name.length > 50) throw new Error("Error: Display name too long");

  const re = /^[a-zA-Z0-9\s\-'.]+$/;
  if (!re.test(name))
    throw new Error("Error: Invalid characters in display name");

  return name.trim();
}

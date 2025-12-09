import { ObjectId } from "mongodb";

export const checkAndTrimString = (
  str,
  variableName = "Some string I forgot to add the name of when running this function"
) => {
  /*
    Inputs: 
        - str: the string to be validated and trimmed
        - variableName: the name of the variable being checked (for error messages) 

    Purpose: To validate that a string is provided and to trim it

    Returns: The trimmed string if valid
    */
  if (!str) throw new Error(`Error: You must provide a ${variableName}`);
  if (typeof str !== "string")
    throw new Error(`Error: ${variableName} must be a string`);
  str = str.trim();
  if (str.length === 0)
    throw new Error(
      `Error: ${variableName} cannot be an empty string or just spaces`
    );
  return str;
};

export function toDateorNull(str) {
  /* 
    Inputs:
        - str: the string to be converted to a Date object

    Purpose: To convert a string to a Date object or return null if the string is empty or invalid

    Returns: A Date object if the string is valid, otherwise null
    */
  if (!str) return null;
  const date = new Date(str);
  return isNaN(date.getTime()) ? null : date;
}

export function checkNumber(num, varName) {
  /* 
    Inputs:
        - num: the number to be validated
        - varName: the name of the variable being checked (for error messages)

    Purpose: To validate that a number is provided and is a finite number

    Returns: The number if it is valid
    */
  if (num === undefined) throw new Error(`${varName} is not provided`);
  if (typeof num !== "number") throw new Error(`${varName} is not a number`);
  if (isNaN(num) || !isFinite(num))
    throw new Error(`${varName} is NaN or Infinity`);
  return num;
}

export function normalizeString(str) {
  /* 
    Inputs:
        - str: the string to be normalized

    Purpose: To normalize a string by trimming and converting to lowercase

    Returns: The normalized string
    */
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

export function checkId(id) {
  if (!id) throw new Error('You must provide an id to search for');
  id = checkAndTrimString(id, 'Id');
  if (!ObjectId.isValid(id)) throw new Error(`${id} is not a valid ObjectId`)
  return id;
}

export function checkString(str, varName) {
  if (!str) throw new Error(`${varName} is required`);
  if (typeof str !== "string") throw new Error(`${varName} must be a string`);
  str = str.trim();
  if (str.length === 0) throw new Error(`${varName} cannot be empty`);
  return str;
}

export function checkEmail(email) {
  email = checkString(email, "email");
  if (email.length > 254) throw new Error("Email too long");
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) throw new Error("Invalid email");
  return email.toLowerCase();
}

export function checkPassword(pw) {
  pw = checkString(pw, "password");
  if (pw.length < 8) throw new Error("Password must be at least 8 characters");
  if (pw.length > 128) throw new Error("Password too long");
  if (!/[a-zA-Z]/.test(pw)) throw new Error("Password must include a letter");
  if (!/[0-9]/.test(pw)) throw new Error("Password must include a number");
  return pw;
}

export function checkName(name) {
  name = checkString(name, "name");
  if (name.length < 2) throw new Error("Name must be at least 2 characters");
  if (name.length > 50) throw new Error("Name too long");
  if (!/^[a-zA-Z\s\-'.]+$/.test(name)) throw new Error("Name contains invalid characters");
  return name.trim();
}

export function checkRating(rating) {
  if (rating === undefined || rating === null) throw new Error("Rating is required");
  const num = Number(rating);
  if (isNaN(num) || !Number.isInteger(num)) throw new Error("Rating must be an integer");
  if (num < 1 || num > 5) throw new Error("Rating must be between 1 and 5");
  return num;
}

export function checkComment(comment) {
  comment = checkString(comment, "comment");
  if (comment.length > 500) throw new Error("Comment cannot exceed 500 characters");
  return comment.trim();
}

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
  return typeof str === "string" ? str.trim() : "";
}

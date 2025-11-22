import { users } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import {
  checkAndTrimString,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateUsername,
  validateDisplayName
} from "../helpers/validation.js";
import bcrypt from "bcrypt";

const sanitizeUser = (user, override = {}) => ({
  _id: user._id.toString(),
  role: user.role,
  username: user.username,
  email: user.email,
  displayName: user.displayName,
  favorites: user.favorites || [],
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  lastLoginAt: user.lastLoginAt,
  ...override
});

const findUserByLogin = async (col, input) => {
  if (input.includes("@")) {
    return col.findOne({ email: validateEmail(input) });
  }
  return col.findOne({ username: validateUsername(input) });
};

let exportedMethods = {

  async registerUser(username, email, password, displayName, confirmPassword = null) {
    username = validateUsername(username);
    email = validateEmail(email);
    password = validatePassword(password);
    displayName = validateDisplayName(displayName);
    if (confirmPassword !== null) validatePasswordMatch(password, confirmPassword);

    const col = await users();

    if (await col.findOne({ email })) throw new Error("Error: Email already exists");
    if (await col.findOne({ username })) throw new Error("Error: Username already exists");

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    const newUser = {
      role: "user",
      username,
      email,
      hashedPassword,
      displayName,
      favorites: [],
      createdAt: now,
      updatedAt: now,
      lastLoginAt: null
    };

    const insert = await col.insertOne(newUser);
    if (!insert.insertedId) throw new Error("Error: Could not create user");

    return sanitizeUser({ _id: insert.insertedId, ...newUser });
  },

  async loginUser(emailOrUsername, password) {
    emailOrUsername = checkAndTrimString(emailOrUsername, "email or username");
    password = checkAndTrimString(password, "password");

    const col = await users();
    const user = await findUserByLogin(col, emailOrUsername);

    if (!user) throw new Error("Error: Invalid email/username or password");

    const valid = await bcrypt.compare(password, user.hashedPassword);
    if (!valid) throw new Error("Error: Invalid email/username or password");

    const now = new Date();
    await col.updateOne({ _id: user._id }, { $set: { lastLoginAt: now, updatedAt: now } });

    return sanitizeUser(user, { updatedAt: now, lastLoginAt: now });
  },

  async getUserByEmail(email) {
    const col = await users();
    const user = await col.findOne({ email: validateEmail(email) });
    return user ? sanitizeUser(user) : null;
  },

  async getUserByUsername(username) {
    const col = await users();
    const user = await col.findOne({ username: validateUsername(username) });
    return user ? sanitizeUser(user) : null;
  },

  async getUserById(id) {
    id = checkAndTrimString(id, "id");
    if (!ObjectId.isValid(id)) throw new Error("Error: Invalid user ID");

    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(id) });
    return user ? sanitizeUser(user) : null;
  }
};

export default exportedMethods;

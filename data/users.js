import { users } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import {
  checkAndTrimString,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateUsername,
  validateDisplayName,
  checkName,
  checkId
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
    id = checkId(id);
    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(id) });
    if (!user) throw new Error(`Error: User with id ${id} not found`);
    return sanitizeUser(user);
  },

  async createUser(firstName, lastName, email, password) {
    firstName = checkName(firstName, "first name");
    lastName = checkName(lastName, "last name");
    email = validateEmail(email);
    password = validatePassword(password);

    const col = await users();
    
    if (await col.findOne({ email })) throw new Error("Error: Email already exists");

    const displayName = `${firstName} ${lastName}`;
    const username = email.split("@")[0] + Math.floor(Math.random() * 1000);
    
    let uniqueUsername = username;
    let counter = 0;
    while (await col.findOne({ username: uniqueUsername }) && counter < 100) {
      uniqueUsername = username + counter;
      counter++;
    }
    if (counter >= 100) throw new Error("Error: Could not generate unique username");

    const hashedPassword = await bcrypt.hash(password, 12);
    const now = new Date();

    const newUser = {
      role: "user",
      username: uniqueUsername.toLowerCase(),
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

  async updateUserProfile(id, updatesObj) {
    if (!updatesObj || typeof updatesObj !== "object") {
      throw new Error("Error: Updates object is required");
    }

    id = checkId(id);
    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(id) });
    if (!user) throw new Error(`Error: User with id ${id} not found`);

    const allowedUpdates = {};
    
    if (updatesObj.displayName !== undefined) {
      allowedUpdates.displayName = validateDisplayName(updatesObj.displayName);
    }
    if (updatesObj.email !== undefined) {
      const newEmail = validateEmail(updatesObj.email);
      const existingUser = await col.findOne({ email: newEmail, _id: { $ne: new ObjectId(id) } });
      if (existingUser) throw new Error("Error: Email already in use");
      allowedUpdates.email = newEmail;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error("Error: No valid fields to update");
    }

    allowedUpdates.updatedAt = new Date();

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: allowedUpdates }
    );

    if (result.modifiedCount === 0) throw new Error("Error: Failed to update user profile");

    return await this.getUserById(id);
  },

  async addFavoriteRestaurant(userId, restaurantId) {
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`Error: User with id ${userId} not found`);

    const restaurantObjId = new ObjectId(restaurantId);
    
    if (user.favorites && user.favorites.some(fav => fav.toString() === restaurantId)) {
      throw new Error("Error: Restaurant is already in favorites");
    }

    const result = await col.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $addToSet: { favorites: restaurantObjId },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) throw new Error("Error: Failed to add favorite restaurant");

    return await this.getUserById(userId);
  },

  async removeFavoriteRestaurant(userId, restaurantId) {
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`Error: User with id ${userId} not found`);

    const restaurantObjId = new ObjectId(restaurantId);
    
    if (!user.favorites || !user.favorites.some(fav => fav.toString() === restaurantId)) {
      throw new Error("Error: Restaurant is not in favorites");
    }

    const result = await col.updateOne(
      { _id: new ObjectId(userId) },
      { 
        $pull: { favorites: restaurantObjId },
        $set: { updatedAt: new Date() }
      }
    );

    if (result.modifiedCount === 0) throw new Error("Error: Failed to remove favorite restaurant");

    return await this.getUserById(userId);
  }
};

export default exportedMethods;

import { users } from "../config/mongoCollections.js";
import { reviews } from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import {
  checkAndTrimString,
  validateEmail,
  validatePassword,
  validatePasswordMatch,
  validateUsername,
  validateDisplayName,
  checkId,
  checkEmail,
  checkPassword,
  checkName,
} from "../helpers/validation.js";
import bcrypt from "bcrypt";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  ...override,
});

const findUserByLogin = async (col, input) => {
  if (input.includes("@")) {
    return col.findOne({ email: validateEmail(input) });
  }
  return col.findOne({ username: validateUsername(input) });
};

let exportedMethods = {
  async createUser(firstName, lastName, email, password) {
    firstName = checkName(firstName);
    lastName = checkName(lastName);
    email = checkEmail(email);
    password = checkPassword(password);

    const col = await users();
    if (await col.findOne({ email })) throw new Error("Email already exists");

    const displayName = `${firstName} ${lastName}`;
    const username = email.split("@")[0] + Math.floor(Math.random() * 1000);

    let uniqueUsername = username;
    let counter = 0;
    while ((await col.findOne({ username: uniqueUsername })) && counter < 100) {
      uniqueUsername = username + counter;
      counter++;
    }
    if (counter >= 100) throw new Error("Could not create user");

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
      lastLoginAt: null,
    };

    const insert = await col.insertOne(newUser);
    if (!insert.insertedId) throw new Error("Could not create user");

    const result = {
      _id: insert.insertedId.toString(),
      role: newUser.role,
      username: newUser.username,
      email: newUser.email,
      displayName: newUser.displayName,
      favorites: newUser.favorites,
      createdAt: newUser.createdAt,
      updatedAt: newUser.updatedAt,
      lastLoginAt: newUser.lastLoginAt,
    };
    return result;
  },

  async getUserByEmail(email) {
    email = checkEmail(email);
    const col = await users();
    const user = await col.findOne({ email });
    if (!user) return null;
    return {
      _id: user._id.toString(),
      role: user.role,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      favorites: user.favorites || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  },

  async getUserById(id) {
    id = checkId(id);
    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(id) });
    if (!user) throw new Error(`User with id ${id} not found`);
    return {
      _id: user._id.toString(),
      role: user.role,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      favorites: user.favorites || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
    };
  },

  async updateUserProfile(id, updatesObj) {
    if (!updatesObj || typeof updatesObj !== "object") {
      throw new Error("Updates object is required");
    }

    id = checkId(id);
    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(id) });
    if (!user) throw new Error(`User with id ${id} not found`);

    const allowedUpdates = {};

    if (updatesObj.displayName !== undefined) {
      allowedUpdates.displayName = checkName(updatesObj.displayName);
    }
    if (updatesObj.email !== undefined) {
      const newEmail = checkEmail(updatesObj.email);
      const existingUser = await col.findOne({
        email: newEmail,
        _id: { $ne: new ObjectId(id) },
      });
      if (existingUser) throw new Error("Email already in use");
      allowedUpdates.email = newEmail;
    }

    if (Object.keys(allowedUpdates).length === 0) {
      throw new Error("No valid fields to update");
    }

    allowedUpdates.updatedAt = new Date();

    const result = await col.updateOne(
      { _id: new ObjectId(id) },
      { $set: allowedUpdates }
    );

    if (result.modifiedCount === 0)
      throw new Error("Failed to update user profile");

    return await this.getUserById(id);
  },

  async addFavoriteRestaurant(userId, restaurantId) {
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const restaurantObjId = new ObjectId(restaurantId);

    if (
      user.favorites &&
      user.favorites.some((fav) => fav.toString() === restaurantId)
    ) {
      throw new Error("Restaurant is already in favorites");
    }

    const result = await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $addToSet: { favorites: restaurantObjId },
        $set: { updatedAt: new Date() },
      }
    );
    if (result.modifiedCount === 0)
      throw new Error("Failed to add favorite restaurant");

    return await this.getUserById(userId);
  },

  async registerUser(
    username,
    email,
    password,
    displayName,
    confirmPassword = null
  ) {
    username = validateUsername(username);
    email = validateEmail(email);
    password = validatePassword(password);
    displayName = validateDisplayName(displayName);
    if (confirmPassword !== null)
      validatePasswordMatch(password, confirmPassword);

    const col = await users();

    if (await col.findOne({ email }))
      throw new Error("Error: Email already exists");
    if (await col.findOne({ username }))
      throw new Error("Error: Username already exists");

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
      lastLoginAt: null,
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
    await col.updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: now, updatedAt: now } }
    );

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
  },

  async removeFavoriteRestaurant(userId, restaurantId) {
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const col = await users();
    const user = await col.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const restaurantObjId = new ObjectId(restaurantId);

    if (
      !user.favorites ||
      !user.favorites.some((fav) => fav.toString() === restaurantId)
    ) {
      throw new Error("Restaurant is not in favorites");
    }

    const result = await col.updateOne(
      { _id: new ObjectId(userId) },
      {
        $pull: { favorites: restaurantObjId },
        $set: { updatedAt: new Date() },
      }
    );

    if (result.modifiedCount === 0)
      throw new Error("Failed to remove favorite restaurant");

    return await this.getUserById(userId);
  },
  async addUserReview(userId, restaurantId, rating, title, body, photos = []) {
    //validate ids
    console.log("-------------testing----------------");
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);
    //validate ratings
    rating = Number(rating);
    if (!rating || typeof rating !== "number" || rating < 1 || rating > 5) {
      throw new Error("Rating must be a number between 1 and 5");
    }
    //Validate review text
    title = checkAndTrimString(title, "review title");
    body = checkAndTrimString(body, "review body");
    //Validate phots
    if(!Array.isArray(photos)) throw new Error("Photos must be in a array");
    photos = photos.map ((p, i) => {
      if (typeof p !== 'object' || p === null || Array.isArray(p)) {
        throw new Error(`Error: Review at index ${i} must be a array`);
      } 
      return {
        url: checkAndTrimString(p.url, `index ${i} photo url`),
        alt: checkAndTrimString(p.alt, `index ${i} photo alt`)
      }
    });
    //Retrieve DB and check for more than one review
    const usersCol = await users();
    const reviewsCol = await reviews();

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const isDuplicate = await reviewsCol.findOne( {
      userId: new ObjectId(userId),
      restaurantId: new ObjectId(restaurantId)
    });

    if (isDuplicate) throw Error("Users may only have one review per resturant");

    const now = new Date();

    const userReview = {
      restaurantId: new ObjectId(restaurantId),
      userId: new ObjectId(userId),
      rating,
      title,
      body,
      photos,
      createdAt: now,
      updatedAt: now
    };

    const insert = await reviewsCol.insertOne(userReview);
    if (!insert.insertedId) throw new Error("Error: Could not add review");
    
    return {
      _id: insert.insertedId.toString(),
      userId,
      restaurantId,
      rating,
      title,
      body,
      photos,
      createdAt: now,
      updatedAt: now
    };
  },
  async removeUserReview(userId, restaurantId) {
    //validate ids
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const usersCol = await users();
    const reviewsCol = await reviews();

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const review = await reviewsCol.findOne({
      userId: new ObjectId(userId),
      restaurantId: new ObjectId(restaurantId)
    });

    if (!review) throw new Error('Error: No resturant review was found for that user');

    if (review.photos && review.photos.length > 0) {
      for (const photo of review.photos) {
        try {
          //https://nodejs.org/api/fs.html
          const filename = photo.url.replace("/uploads/", "");
          const filePath = path.join(__dirname, "..", "public", "uploads", filename);
          await fs.unlink(filePath);
          console.log("Deleted file:", filePath);
        } catch (err) {
          console.error("Failed to delete image:", err);
        }
      }
  }

    const deletedReview = await reviewsCol.deleteOne({
      userId: new ObjectId(userId),
      restaurantId: new ObjectId(restaurantId)
    });

    if (deletedReview.deletedCount === 0) throw new Error("Error: Failed to delete review");

    return {
      reviewRemoved: true,
      userId,
      restaurantId
    }
  },
  async getReviewByUser(userId, restaurantId) {
    userId = checkId(userId);
    restaurantId = checkId(restaurantId);

    const usersCol = await users();
    const reviewsCol = await reviews();

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const review = await reviewsCol.findOne({
      userId: new ObjectId(userId),
      restaurantId: new ObjectId(restaurantId)
    });

    if (!review) throw new Error('Error: No resturant review was found for that user');

    return {
      ...review,
      _id: review._id.toString(),
      restaurantId: review.restaurantId.toString(),
      userId: review.userId.toString()
    };
  },
  async getUserReviews(userId) {
    userId = checkId(userId);

    const reviewsCol = await reviews();
    const usersCol = await users();

    const user = await usersCol.findOne({ _id: new ObjectId(userId) });
    if (!user) throw new Error(`User with id ${userId} not found`);

    const userReviews = await reviewsCol.find({ userId: new ObjectId(userId) }).toArray();

    if (!userReviews || userReviews.length === 0) return [];

    return userReviews.map((review) => ({
    _id: review._id.toString(),
    userId: review.userId.toString(),
    restaurantId: review.restaurantId.toString(),
    rating: review.rating,
    title: review.title,
    body: review.body,
    photos: review.photos,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt
    }));
  }
};

export default exportedMethods;

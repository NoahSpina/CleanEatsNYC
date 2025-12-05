// Restaurant Methods
/*
    Todo:
        createRestaurant:
            update latestGrade, latestScore, latestInspectionDate, Streak, cleanstreak and badge
        add more methods if needed
        add reviews interactions
*/

import {
  users,
  restaurants,
  inspections,
  reviews,
  comments,
} from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import {
  checkId,
  checkNumber,
  checkAndTrimString,
  normalizeString,
} from "../helpers/validation.js";

let exportedMethods = {
  async getRestaurantsOnPage(page, limit) {
    const restaurantCollection = await restaurants();
    const skip = (page - 1) * limit; // for pagination.
    const restaurantList = await restaurantCollection
      .find({})
      .sort({ name: 1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    const restaurantCount = await restaurantCollection.countDocuments({});
    return { restaurantList, restaurantCount };
  },

  async getAllRestaurants() {
    /* 
        Inputs: N/A

        Purpose: To retrieve an array of all restaurants

        Returns: An array of all restaurant objects
    */
    const restaurantCollection = await restaurants();
    return await restaurantCollection.find({}).toArray();
  },

  async getRestaurantById(id) {
    /* 
        Inputs: 
            - id: string of a restaurant's id

        Purpose: To retrieve a restaurant from its id

        Returns: Restaurant object
    */
    id = checkId(id);

    const restaurantCollection = await restaurants();
    const restaurant = await restaurantCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!restaurant)
      throw new Error(`No restaurant with id of ${id} was found`);
    return restaurant;
  },

  async getRestaurantByCamis(camis) {
    /* 
        Inputs: 
            - camis: a string of the unique identifier for a NYC Open Data restaurant

        Purpose: To retrieve a restaurant from its camis id

        Returns: Restaurant object
    */
    camis = checkNumber(Number(camis), "camis");

    const restaurantCollection = await restaurants();
    const restaurant = await restaurantCollection.findOne({ camis });

    if (!restaurant)
      throw new Error(`No restaurant with camis of ${id} was found`);
  },

  async searchRestaurants({ borough, cuisine, grade, searchTerm }) {
    /*
        Inputs: A object containing
            - borough: a string of the NYC borough
            - cuisine: a string of the cuisine type
            - grade: a string of the grade
            - searchTerm: a string of the restaurant name

        Purpose: To retrieve a list of restaurants with the given characterisitcs

        Returns: Array of restaurants
    */
    const restaurantCollection = await restaurants();

    const query = {};

    if (borough) {
      query.borough = checkAndTrimString(borough).toLowerCase();
    }
    if (cuisine) {
      query.cuisine = checkAndTrimString(cuisine);
    }
    if (grade) {
      query.grade = checkAndTrimString(grade).toLowerCase();
    }
    if (searchTerm) {
      const searchTermValidated = checkAndTrimString(searchTerm);
      query.name = {
        $regex: normalizeString(searchTermValidated),
        $options: "i",
      };
    }

    return restaurantCollection.find(query).toArray();
  },

  async getRestaurantWithInspections(id) {
    /*
        Inputs: 
            - id: string of a restaurant's id

        Purpose: To retrieve a restaurant from its id and the associated inspections

        Returns: Restaurant object with all its inspections
    */

    id = checkId(id);
    const restaurantCollection = await restaurants();
    const inspectionCollection = await inspections();

    const restaurant = await restaurantCollection.findOne({
      _id: new Object(id),
    });
    if (!restaurant)
      throw new Error(`No restaurant found with the id of ${id}`);

    const inspectionHistory = await inspectionCollection
      .find({ restaurantId: new ObjectId() })
      .sort({ inspectionDate: -1 })
      .toArray();

    return { ...restaurant, inspections: inspectionHistory };
  },

  //    Admin methods
  async createRestaurant(data) {
    /*
        Inputs:
            - data: a object containing the information of the new restaurant
        
        Purpose: To add a new restaurant to the database

        Returns: The new restaurant object
    */

    const restaurantCollection = await restaurants();

    const newRestaurant = {
      camis: checkNumber(data.camis, "camis"),
      name: checkAndTrimString(data.name).toLowerCase(),
      borough: checkAndTrimString(data.borough),
      cuisine: checkAndTrimString(data.cuisine),
      address: {
        building: normalizeString(data.address?.building),
        street: normalizeString(data.address?.street),
        zipcode: normalizeString(data.address?.zipcode),
      },
      location: data.location || null,
      latestGrade: null,
      latestScore: null,
      latestInspectionDate: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      cleanStreakCount: 0,
      hasCleanStreakBadge: false,
    };

    //TODO update information (ie. latestGrade, latestScore, cleanStreakCount etc)

    const insertedRestaurant = await restaurantCollection.insertOne(
      newRestaurant
    );
    if (!insertedRestaurant) throw new Error("Failed to create new restaurant");
    if (!insertedRestaurant.insertedId)
      throw new Error("Failed to create new restaurant id");

    return await this.getRestaurantById(
      insertedRestaurant.insertedId.toString()
    );
  },

  async updateRestaurant(id, updates) {
    /*
        Inputs:
            - id: restaurant id string
            - updates: object containing updates
        
        Purpose: To update a restaurant's information

        Returns: The updated restaurant object
    */
    id = checkId(id);
    const restaurantCollection = await restaurants();

    const updatedRestaurant = {
      ...updates,
      updatedAt: new Date(),
    };

    const result = await restaurantCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updatedRestaurant }
    );
    if (result.matchedCount === 0)
      throw new Error(`Restaurant with the id ${id} could not be found`);

    return await this.getRestaurantById(id);
  },

  async deleteRestaurant(id) {
    /*
        Inputs:
            - id: restaurant id string
        
        Purpose: To remove a restaurant from the database

        Returns: A object confirming the deletion
    */
    id = checkId(id);

    const restaurantCollection = await restaurants();
    const inspectionCollection = await inspections();
    //const reviewCollection = await reviews();
    //Add back when reviews are added

    await inspectionCollection.deleteMany({ restaurantId: new ObjectId(id) });
    const result = await restaurantCollection.deleteOne({
      _id: new ObjectId(id),
    });
    if (result.deletedCount === 0)
      throw new Error(`Failed to delete restaurant with id ${id}`);
    return { deleted: true };
  },
};

export default exportedMethods;

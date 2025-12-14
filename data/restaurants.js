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
  async getRestaurantsOnPage(page, limit, sortBy = "name", order = "asc", searchTerm = "", filterOptions = {}) {
    const restaurantCollection = await restaurants();
    const skip = (page - 1) * limit;

    let sortDirection = 1;
    if (order === "desc") {
      sortDirection = -1;
    }

    let query = {};
    if (searchTerm) {
        // Simple regex search in mongo, case-insensitive (that's what the $options: "i" does)
        const validSearch = checkAndTrimString(searchTerm);
        query.name = { $regex: normalizeString(validSearch), $options: "i" };
    }

    if (filterOptions.borough) {
        query.borough = checkAndTrimString(filterOptions.borough).toLowerCase();
    }
    if (filterOptions.cuisine) {
        query.cuisine = checkAndTrimString(filterOptions.cuisine);
    }
    if (filterOptions.grade) {
        query.latestGrade = checkAndTrimString(filterOptions.grade);
    }
    if (filterOptions.ids) {
      // only shows restaurants with ids in the user.favorites array (stored in mongo)
        query._id = { $in: filterOptions.ids.map(id => new ObjectId(id)) };
    }

    let sortQuery = { name: sortDirection };
    let sortFieldQuery = {};
    
    if (sortBy === "rating") {
      sortQuery = { latestScore: sortDirection, name: 1 };
      // only get restaurants that actually have a score
      sortFieldQuery.latestScore = { $exists: true, $ne: null, $type: "number" };
    } else if (sortBy === "grade") {
      sortQuery = { latestGrade: sortDirection, name: 1 };
      // only get restaurants that have a grade
      sortFieldQuery.latestGrade = { $exists: true, $ne: null, $ne: "" };
    } else if (sortBy === "inspectionDate") {
      sortQuery = { latestInspectionDate: sortDirection, name: 1 };
      // only get restaurants that have an inspection date
      sortFieldQuery.latestInspectionDate = { $exists: true, $ne: null, $ne: "" };
    }

    const restaurantCount = await restaurantCollection.countDocuments(query);
    let restaurantList;

    if (sortBy === "rating" || sortBy === "grade" || sortBy === "inspectionDate") {
      // get restaurants that have the data we need to sort by
      const withDataQuery = { ...query, ...sortFieldQuery };
      const withDataCount = await restaurantCollection.countDocuments(withDataQuery);
      
      // get restaurants that don't have the data (will show at the end)
      const withoutDataQuery = { ...query };
      if (sortBy === "rating") {
        withoutDataQuery.$or = [
          { latestScore: { $exists: false } },
          { latestScore: null },
          { latestScore: { $not: { $type: "number" } } }
        ];
      } else if (sortBy === "grade") {
        withoutDataQuery.$or = [
          { latestGrade: { $exists: false } },
          { latestGrade: null },
          { latestGrade: "" }
        ];
      } else if (sortBy === "inspectionDate") {
        withoutDataQuery.$or = [
          { latestInspectionDate: { $exists: false } },
          { latestInspectionDate: null },
          { latestInspectionDate: "" }
        ];
      }
      
      // if we're still looking at restaurants with data
      if (skip < withDataCount) {
        const remainingLimit = Math.min(limit, withDataCount - skip);
        restaurantList = await restaurantCollection
          .find(withDataQuery)
          .sort(sortQuery)
          .skip(skip)
          .limit(remainingLimit)
          .toArray();
        
        // if we need more results, grab some without data too
        if (restaurantList.length < limit) {
          const withoutDataList = await restaurantCollection
            .find(withoutDataQuery)
            .sort({ name: 1 })
            .limit(limit - restaurantList.length)
            .toArray();
          restaurantList = [...restaurantList, ...withoutDataList];
        }
      } else {
        // we're past the restaurants with data, so get ones without
        const skipWithoutData = skip - withDataCount;
        restaurantList = await restaurantCollection
          .find(withoutDataQuery)
          .sort({ name: 1 })
          .skip(skipWithoutData)
          .limit(limit)
          .toArray();
      }
    } else {
      // name sort is simple, just use mongo sort
      restaurantList = await restaurantCollection
        .find(query)
        .sort(sortQuery)
        .skip(skip)
        .limit(limit)
        .toArray();
    }
    
    const paginatedList = restaurantList;
    
    return { restaurantList: paginatedList, restaurantCount };
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
      throw new Error(`No restaurant with camis of ${camis} was found`);
    return restaurant;
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
      query.latestGrade = checkAndTrimString(grade).toUpperCase();
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

  async getFilterOptions() {
    /*
        Inputs: N/A
        
        Purpose: To retrieve lists of all available boroughs, cuisines, and grades for filtering
        
        Returns: Object containing arrays of boroughs, cuisines, and grades
    */
    const restaurantCollection = await restaurants();
    // Using aggregation to get distinct values efficiently
    const boroughs = await restaurantCollection.distinct("borough");
    const cuisines = await restaurantCollection.distinct("cuisine");
    const grades = await restaurantCollection.distinct("latestGrade");

    // Filter out null/empty values and sort
    const cleanBoroughs = boroughs.filter(b => b).sort();
    const cleanCuisines = cuisines.filter(c => c).sort();
    const cleanGrades = grades.filter(g => g).sort();

    return {
        boroughs: cleanBoroughs,
        cuisines: cleanCuisines,
        grades: cleanGrades
    };
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
      _id: new ObjectId(id),
    });
    if (!restaurant)
      throw new Error(`No restaurant found with the id of ${id}`);

    const inspectionHistory = await inspectionCollection
      .find({ restaurantId: new ObjectId(id) })
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
  async getAllReviewsForRestaurant(restaurantId) {
    /*
        Inputs:
            - id: restaurant id string
        
        Purpose: To remove a restaurant from the database

        Returns: A object confirming the deletion
    */

    restaurantId = checkId(restaurantId);

    const restaurantCollection = await restaurants();
    const reviewsCollection = await reviews();
    const usersCollection = await users();

    const restaurant = await restaurantCollection.findOne({_id: new ObjectId(restaurantId)});
    if (!restaurant) throw new Error(`Restaurant with the id ${restaurantId} could not be found`);
    const reviewList = await reviewsCollection.find({ restaurantId: new ObjectId(restaurantId) }).sort({ createdAt: -1 }).toArray();
    if (reviewList.length === 0) return [];

    const reviewsOutput = [];

    for (const review of reviewList) {
      const user = await usersCollection.findOne({ _id: review.userId });
      
      reviewsOutput.push({
        _id: review._id.toString(),
        restaurantId: review.restaurantId.toString(),
        userId: review.userId.toString(),
        rating: review.rating,
        title: review.title,
        body: review.body,
        photos: review.photos,
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      });
    }
    return reviewsOutput;
  },
};

export default exportedMethods;

// Inspection methods
/*
    TODO:
        add admin methods
            create, update, remove inspection
*/

import {
  users,
  restaurants,
  inspections,
  reviews,
  comments,
} from "../config/mongoCollections.js";
import { ObjectId } from "mongodb";
import { checkId } from "../helpers/validation.js";

let exportedMethods = {
  async getInspectionById(id) {
    /* 
            Inputs: 
                - id: string of a restaurant's id
    
            Purpose: To retrieve a inspection from its id
    
            Returns: Inspection object
        */
    id = checkId(id);

    const inspectionCollection = await inspections();
    const inspection = await inspectionCollection.findOne({
      _id: new ObjectId(id),
    });
    if (!inspection)
      throw new Error(`No inspection was found with the id ${id}`);
    return inspection;
  },
  async getInspectionsByRestaurant(restaurantId) {
    /* 
            Inputs: 
                - restaurantId: string of a restaurant's id
    
            Purpose: To retrieve the inspections of a restaurant
    
            Returns: Array of inspection objects
        */
    restaurantId = checkId(restaurantId);

    const inspectionCollection = await inspections();
    const restaurantCollection = await restaurants();

    //Validate restaurant exists with that id
    const restaurant = await restaurantCollection.findOne({
      _id: new ObjectId(restaurantId),
    });
    if (!restaurant) throw new Error(`No restaurant found with the id ${restaurantId}`);

    const inspectionsList = await inspectionCollection
      .find({ restaurantId: new ObjectId(restaurantId) })
      .sort({ inspectionDate: -1 })
      .toArray();

    return inspectionsList;
  },
};

export default exportedMethods;

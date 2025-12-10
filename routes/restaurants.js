import restaurantData from "../data/restaurants.js";
import { Router } from "express";
import { checkId } from "../helpers/validation.js";
import inspectionData from "../data/inspections.js";
import userData from "../data/users.js";
import images from "../middleware/images.js";

const router = Router();

router.route("/restaurants").get(async (req, res) => {
  try {
    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) page = 1;

    const limit = 50;

    const { restaurantList, restaurantCount } =
      await restaurantData.getRestaurantsOnPage(page, limit);
    const totalPages = Math.ceil(restaurantCount / limit);

    res.render("restaurants/restaurants", {
      title: "Restaurants",
      restaurantList,
      page,
      totalPages,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
    });
  } catch (e) {
    res
      .status(500)
      .render("error", { title: "Error", error: "Internal Server Error." });
  }
});

router.route("/restaurants/:id").get(async (req, res) => {
  let id = req.params.id;

  try {
    id = checkId(id);

    const restaurant = await restaurantData.getRestaurantById(id);
    const inspections = await inspectionData.getInspectionsByRestaurant(id);
    const reviews = await restaurantData.getAllReviewsForRestaurant(id);

    res.render("restaurants/restaurantsId", {
      title: restaurant.name,
      restaurant,
      inspections,
      reviews,   
      user: req.session.user
    });
  } catch (e) {
    res.status(404).render("error", { title: "Error", error: e?.message });
  }
});

router.route("/restaurants/:id").post(images.array("photos"), async (req, res) => {
  //https://www.npmjs.com/package/multer
  if (!req.session.user) {
    return res.status(403).render("error", {
      title: "Forbidden",
      error: "You must be logged in to submit a review."
    });
  }
  let restaurantId = req.params.id;

  try {
    restaurantId = checkId(restaurantId);
    const userId = req.session.user._id;
    const { rating, title, body, photoDescriptions = "" } = req.body;
    let photos = [];
    if (req.files && req.files.length > 0) {
      let altTexts = [];
      if (photoDescriptions && photoDescriptions.trim().length > 0) {
          altTexts = photoDescriptions.split("\n").map((text) => text.trim()).filter((text) => text.length > 0);
      }
      photos = req.files.map((file, index) => ({
        url: `/uploads/${file.filename}`,
          alt: altTexts[index] || "" 
      }));
    }
    

    await userData.addUserReview(userId, restaurantId, rating, title, body, photos);

    return res.redirect(`/restaurants/${restaurantId}`);
  } catch (e) {
    const restaurant = await restaurantData.getRestaurantById(restaurantId);
    const reviews = await restaurantData.getAllReviewsForRestaurant(restaurantId);
    return res.status(400).render("restaurants/restaurantsId", {
        title: restaurant.name,
        restaurant,
        reviews,
        user: req.session.user,
        error: e.message
      });
  }
});

export default router;

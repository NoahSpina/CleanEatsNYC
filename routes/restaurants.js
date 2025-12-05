import restaurantData from "../data/restaurants.js";
import { Router } from "express";

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

export default router;

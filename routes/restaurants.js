import restaurantData from "../data/restaurants.js";
import { Router } from "express";
import { checkId } from "../helpers/validation.js";
import inspectionData from "../data/inspections.js";

const router = Router();

router.route("/restaurants").get(async (req, res) => {
  try {
    const validSorts = ["name", "rating", "grade", "inspectionDate"];
    let sort = "name";
    if (req.query.sort && validSorts.includes(req.query.sort)) {
      sort = req.query.sort;
    }

    const validOrders = ["asc", "desc"];
    let order = "asc";
    if (req.query.order && validOrders.includes(req.query.order)) {
      order = req.query.order;
    } else if (req.query.sort && !req.query.order) {
      if (sort === "inspectionDate" || sort === "rating") {
        order = "desc";
      } else {
        order = "asc";
      }
    }

    let search = "";
    if (req.query.search) {
      search = req.query.search;
    }

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    const limit = 50;
    const { restaurantList, restaurantCount } =
      await restaurantData.getRestaurantsOnPage(page, limit, sort, order, search);
    const totalPages = Math.ceil(restaurantCount / limit);

    const buildUrl = (newPage, newSort, newOrder, newSearch) => {
      let url = "/restaurants";
      const params = [];
      
      if (newPage > 1) {
        params.push("page=" + newPage);
      }
      if (newSort !== "name") {
        params.push("sort=" + newSort);
      }
      if (newOrder) {
        params.push("order=" + newOrder);
      }
      if (newSearch) {
        // need to use encodeURIComponent because special characters might break URL, but not with encodeURIComponent
        params.push("search=" + encodeURIComponent(newSearch));
      }
      
      if (params.length > 0) {
        url = url + "?" + params.join("&");
      }
      
      return url;
    };

    const hasPrevPage = page > 1;
    const hasNextPage = page < totalPages;
    const prevPage = page - 1;
    const nextPage = page + 1;

    res.render("restaurants/restaurants", {
      title: "Restaurants",
      restaurantList,
      page,
      totalPages,
      sort,
      order,
      search,
      hasPrevPage,
      hasNextPage,
      prevPage,
      nextPage,
      buildUrl,
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

    res.render("restaurants/restaurantsId", {
      title: restaurant.name,
      restaurant,
      inspections,
    });
  } catch (e) {
    let errorMessage = "Restaurant not found";
    if (e.message) {
      errorMessage = e.message;
    }
    res.status(404).render("error", { title: "Error", error: errorMessage });
  }
});

export default router;

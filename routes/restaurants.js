import restaurantData from "../data/restaurants.js";
import { Router } from "express";
import { checkId } from "../helpers/validation.js";
import inspectionData from "../data/inspections.js";
import userData from "../data/users.js";
import images from "../middleware/images.js";

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

    const filters = {};
    if (req.query.borough) filters.borough = req.query.borough;
    if (req.query.cuisine) filters.cuisine = req.query.cuisine;
    if (req.query.grade) filters.grade = req.query.grade;
    
    // favorites filter
    let favoritesOnly = false;
    if (req.query.favoritesOnly === 'true' && req.session.user && req.session.user.favorites) {
        favoritesOnly = true;
        filters.ids = req.session.user.favorites;
    }

    let page = parseInt(req.query.page, 10);
    if (isNaN(page) || page < 1) {
      page = 1;
    }

    // Get filter options for dropdowns
    const filterOptionsList = await restaurantData.getFilterOptions();

    const limit = 50;
    const { restaurantList, restaurantCount } =
      await restaurantData.getRestaurantsOnPage(page, limit, sort, order, search, filters);

    // checks for favorites
    if (req.session.user.favorites) {
      const userFavorites = req.session.user.favorites.map(id => id.toString());
      restaurantList.forEach(restaurant => {
        restaurant.isFavorite = userFavorites.includes(restaurant._id.toString());
      });
    }

    const totalPages = Math.ceil(restaurantCount / limit);

    const buildUrl = (newPage, newSort, newOrder, newSearch) => {
      let url = "/restaurants";
      const params = [];
      
      if (newPage > 1) {
        params.push("page=" + newPage);
      }
      if (newSort && newSort !== "name") {
        params.push("sort=" + newSort);
        // need to include order so it doesn't reset when switching pages
        if (newOrder) {
          params.push("order=" + newOrder);
        }
      } else if (newSort === "name" && newOrder && newOrder !== "asc") {
        // only add order if it's not the default
        params.push("order=" + newOrder);
      }
      if (newSearch) {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/encodeURIComponent
        // need to use encodeURIComponent because special characters might break URL, but not with encodeURIComponent
        params.push("search=" + encodeURIComponent(newSearch));
      }
      if (filters.borough) params.push("borough=" + encodeURIComponent(filters.borough));
      if (filters.cuisine) params.push("cuisine=" + encodeURIComponent(filters.cuisine));
      if (filters.grade) params.push("grade=" + encodeURIComponent(filters.grade));
      if (favoritesOnly) params.push("favoritesOnly=true");
      
      // keeps track of the accordion (if its open or closed)
      if (req.query.open) {
        params.push("open=" + req.query.open);
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
      filterOptions: filterOptionsList,
      selectedBorough: filters.borough,
      selectedCuisine: filters.cuisine,
      selectedGrade: filters.grade,
      favoritesOnly,
      accordionOpen: req.query.open === 'true',
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
    
    // checks if this restaurant is a user's favorite
    if (req.session.user.favorites) {
      restaurant.isFavorite = req.session.user.favorites.some(favId => favId.toString() === id);
    }

    const inspections = await inspectionData.getInspectionsByRestaurant(id);
    const reviews = await restaurantData.getAllReviewsForRestaurant(id);

    let userHasReviewed = false;
    if (req.session.user) {
        userHasReviewed = reviews.some(review => review.userId === req.session.user._id);
    }

    res.render("restaurants/restaurantsId", {
      title: restaurant.name,
      restaurant,
      inspections,
      reviews,   
      user: req.session.user,
      userHasReviewed
    });
  } catch (e) {
    let errorMessage = "Restaurant not found";
    if (e.message) {
      errorMessage = e.message;
    }
    res.status(404).render("error", { title: "Error", error: errorMessage });
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

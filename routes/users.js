import { Router } from "express";
import userData from "../data/users.js";
import restaurantData from "../data/restaurants.js";
import xss from "xss";

const router = Router();

const requireAuth = (req, res, next) => {
  if (!req.session?.user) return res.redirect("/login");
  next();
};

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await userData.getUserById(req.session.user._id);
    const reviews = await userData.getUserReviews(req.session.user._id);
    const reviewsWithRestaurantInfo = [];
    for (let review of reviews) {
      let restaurant = await restaurantData.getRestaurantById(review.restaurantId);
      reviewsWithRestaurantInfo.push({...review, restaurantName: restaurant.name});
    }
    let favorites = [];
    if (user.favorites && user.favorites.length > 0) {
      const favoritePromises = user.favorites.filter(id => id).map(id => restaurantData.getRestaurantById(id.toString()));
      favorites = await Promise.all(favoritePromises);
    }
    res.render("users/profile", { title: "My Profile", user, favorites, reviews: reviewsWithRestaurantInfo });
  } catch (e) {
    res.status(500).render("error", { title: "Error", error: e.message, user: req.session?.user || null });
  }
});

router.get("/profile/edit", requireAuth, async (req, res) => {
  try {
    const user = await userData.getUserById(req.session.user._id);
    res.render("users/editProfile", { title: "Edit Profile", user });
  } catch (e) {
    res.status(500).render("error", { title: "Error", error: e.message, user: req.session?.user || null });
  }
});

router.post("/profile", requireAuth, async (req, res) => {
  try {
    const updates = {};
    if (req.body.displayName) updates.displayName = xss(req.body.displayName);
    if (req.body.email) updates.email = xss(req.body.email);
    const updatedUser = await userData.updateUserProfile(req.session.user._id, updates);
    req.session.user = updatedUser;
    res.redirect("/profile");
  } catch (e) {
    const user = await userData.getUserById(req.session.user._id).catch(() => null);
    res.status(400).render("users/editProfile", { title: "Edit Profile", error: e.message, user: user || req.session.user });
  }
});

router.post("/favorite/:id", requireAuth, async (req, res) => {
  try {
    const restaurantId = xss(req.params.id);
    const updatedUser = await userData.addFavoriteRestaurant(req.session.user._id, restaurantId);
    req.session.user = updatedUser;
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete("/favorite/:id", requireAuth, async (req, res) => {
  try {
    const restaurantId = xss(req.params.id);
    const updatedUser = await userData.removeFavoriteRestaurant(req.session.user._id, restaurantId);
    req.session.user = updatedUser;
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete("/review/:restaurantId", requireAuth, async (req, res) => {
  try {
    const restaurantId = xss(req.params.restaurantId);
    await userData.removeUserReview(req.session.user._id, restaurantId);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await userData.getUserById(req.params.id);
    const isOwnProfile = req.session?.user?._id === user._id;
    const userId = xss(req.params.id);
    res.render("users/userPublicProfile", { title: `${user.displayName}'s Profile`, profileUser: user, isOwnProfile, user: req.session?.user || null });
  } catch (e) {
    res.status(404).render("error", { title: "User Not Found", error: e.message, user: req.session?.user || null });
  }
});

export default router;


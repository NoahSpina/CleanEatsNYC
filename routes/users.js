import { Router } from "express";
import userData from "../data/users.js";

const router = Router();

const requireAuth = (req, res, next) => {
  if (!req.session?.user) return res.redirect("/login");
  next();
};

router.get("/profile", requireAuth, async (req, res) => {
  try {
    const user = await userData.getUserById(req.session.user._id);
    res.render("users/profile", { title: "My Profile", user });
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
    if (req.body.displayName) updates.displayName = req.body.displayName;
    if (req.body.email) updates.email = req.body.email;
    const updatedUser = await userData.updateUserProfile(req.session.user._id, updates);
    req.session.user = updatedUser;
    res.redirect("/profile");
  } catch (e) {
    const user = await userData.getUserById(req.session.user._id).catch(() => null);
    res.status(400).render("users/editProfile", { title: "Edit Profile", error: e.message, user: user || req.session.user });
  }
});

router.get("/favorites", requireAuth, async (req, res) => {
  try {
    const user = await userData.getUserById(req.session.user._id);
    res.render("users/favorites", { title: "My Favorites", user, favorites: user.favorites || [] });
  } catch (e) {
    res.status(500).render("error", { title: "Error", error: e.message, user: req.session?.user || null });
  }
});

router.post("/favorite/:id", requireAuth, async (req, res) => {
  try {
    await userData.addFavoriteRestaurant(req.session.user._id, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.delete("/favorite/:id", requireAuth, async (req, res) => {
  try {
    await userData.removeFavoriteRestaurant(req.session.user._id, req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    const user = await userData.getUserById(req.params.id);
    const isOwnProfile = req.session?.user?._id === user._id;
    res.render("users/userPublicProfile", { title: `${user.displayName}'s Profile`, profileUser: user, isOwnProfile, user: req.session?.user || null });
  } catch (e) {
    res.status(404).render("error", { title: "User Not Found", error: e.message, user: req.session?.user || null });
  }
});

export default router;


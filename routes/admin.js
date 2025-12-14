import { Router } from "express";
import { users, restaurants } from "../config/mongoCollections.js";
import { checkAndTrimString, checkEmail, checkId } from "../helpers/validation.js";
import { ObjectId } from "mongodb";
import restaurantData from "../data/restaurants.js";

const router = Router();

const oid = (id) => new ObjectId(checkId(id));

const ensureAdmin = (req, res, next) => {
  if (req.session?.user?.role !== "admin") {
    return res.status(403).render("error", {
      title: "Access Denied",
      error: "Admin access required",
      user: req.session?.user || null,
    });
  }
  next();
};

const restaurantFields = ({ name, borough, cuisine, building, street, zipcode }) => ({
  name: checkAndTrimString(name, "restaurant name"),
  borough: checkAndTrimString(borough, "borough").toLowerCase(),
  cuisine: checkAndTrimString(cuisine, "cuisine"),
  "address.building": checkAndTrimString(building, "building"),
  "address.street": checkAndTrimString(street, "street"),
  "address.zipcode": checkAndTrimString(zipcode, "zipcode"),
});

router.get("/", ensureAdmin, (req, res) =>
  res.render("admin/dashboard", {
    title: "Admin Dashboard",
    user: req.session.user,
  })
);

router.get("/users", ensureAdmin, async (req, res) => {
  try {
    const allUsers = await (await users()).find({}).toArray();
    res.render("admin/users", {
      title: "User Management",
      user: req.session.user,
      users: allUsers,
    });
  } catch (err) {
    console.error("Admin users error:", err);
    res.status(500).render("error", {
      title: "Error",
      error: "Failed to load users",
      user: req.session.user,
    });
  }
});

router.get("/restaurants", ensureAdmin, async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const search = req.query.search || "";
    const limit = 15;

    const { restaurantList, restaurantCount } =
      await restaurantData.getRestaurantsOnPage(
        page,
        limit,
        "name",
        "asc",
        search,
        {}
      );

    const totalPages = Math.ceil(restaurantCount / limit);
    const buildUrl = (p, s) =>
      `/admin/restaurants?${
        [p > 1 && `page=${p}`, s && `search=${encodeURIComponent(s)}`]
          .filter(Boolean)
          .join("&")
      }`;

    res.render("admin/restaurants", {
      title: "Restaurant Management",
      user: req.session.user,
      restaurants: restaurantList,
      search,
      page,
      totalPages,
      totalRestaurants: restaurantCount,
      hasPrevPage: page > 1,
      hasNextPage: page < totalPages,
      prevPage: page - 1,
      nextPage: page + 1,
      buildUrl,
    });
  } catch (err) {
    console.error("Admin restaurants error:", err);
    res.status(500).render("error", {
      title: "Error",
      error: "Failed to load restaurants",
      user: req.session.user,
    });
  }
});

router.post("/users/:id/edit", ensureAdmin, async (req, res) => {
  try {
    const _id = oid(req.params.id);
    const usersCol = await users();

    const username = checkAndTrimString(req.body.username, "username");
    const displayName = checkAndTrimString(req.body.displayName, "display name");
    const email = checkEmail(req.body.email);

    const duplicate = await usersCol.findOne({
      _id: { $ne: _id },
      $or: [{ username }, { email }],
    });

    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "Username or email already exists",
      });
    }

    const result = await usersCol.updateOne(
      { _id },
      {
        $set: { username, displayName, email, updatedAt: new Date() },
      }
    );

    if (!result.matchedCount) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Edit user error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/users/:id", ensureAdmin, async (req, res) => {
  try {
    if (req.params.id === req.session.user._id) {
      return res
        .status(400)
        .json({ success: false, error: "Cannot delete your own account" });
    }

    const result = await (await users()).deleteOne({
      _id: oid(req.params.id),
    });

    if (!result.deletedCount) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete user error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/restaurants", ensureAdmin, async (req, res) => {
  try {
    await (await restaurants()).insertOne({
      _id: new ObjectId(),
      camis: Math.floor(Math.random() * 9e7) + 1e7,
      ...restaurantFields(req.body),
      location: null,
      latestGrade: null,
      latestScore: null,
      latestInspectionDate: null,
      cleanStreakCount: 0,
      hasCleanStreakBadge: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.json({ success: true });
  } catch (err) {
    console.error("Add restaurant error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/restaurants/:id/edit", ensureAdmin, async (req, res) => {
  try {
    const result = await (await restaurants()).updateOne(
      { _id: oid(req.params.id) },
      { $set: { ...restaurantFields(req.body), updatedAt: new Date() } }
    );

    if (!result.matchedCount) {
      return res
        .status(404)
        .json({ success: false, error: "Restaurant not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Edit restaurant error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete("/restaurants/:id", ensureAdmin, async (req, res) => {
  try {
    const result = await (await restaurants()).deleteOne({
      _id: oid(req.params.id),
    });

    if (!result.deletedCount) {
      return res
        .status(404)
        .json({ success: false, error: "Restaurant not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Delete restaurant error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

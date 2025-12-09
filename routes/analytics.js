import { Router } from "express";
import { restaurants, inspections, reviews } from "../config/mongoCollections.js";
import { checkAndTrimString } from "../helpers/validation.js";

const router = Router();

// Check if user is logged in
const ensureAuthenticated = (req, res, next) => {
  if (!req.session?.user) {
    return res.status(401).render("error", {
      title: "Unauthorized",
      error: "You must be logged in to access this page",
      user: null,
    });
  }
  next();
};

// Main analytics page
router.get("/", ensureAuthenticated, (req, res) => {
  res.render("analytics", {
    title: "Analytics Dashboard",
    user: req.session.user,
  });
});

// Get ratings data
router.get("/ratings", ensureAuthenticated, async (req, res) => {
  try {
    const { borough, cuisine } = req.query;
    const reviewsCollection = await reviews();
    const restaurantsCollection = await restaurants();

    // Get all restaurants for filter options
    const allRestaurants = await restaurantsCollection.find({}).toArray();
    const boroughs = [...new Set(allRestaurants.map(r => r.borough))].filter(Boolean).sort();
    const cuisines = [...new Set(allRestaurants.map(r => r.cuisine))].filter(Boolean).sort();

    // Build filter
    const filter = {};
    if (borough?.trim()) filter["restaurant.borough"] = checkAndTrimString(borough, "borough");
    if (cuisine?.trim()) filter["restaurant.cuisine"] = checkAndTrimString(cuisine, "cuisine");

    // Get top 10 restaurants by rating
    const pipeline = [
      { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
      { $unwind: "$restaurant" },
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      {
        $group: {
          _id: "$restaurantId",
          restaurantName: { $first: "$restaurant.name" },
          borough: { $first: "$restaurant.borough" },
          cuisine: { $first: "$restaurant.cuisine" },
          latestGrade: { $first: "$restaurant.latestGrade" },
          latestInspectionDate: { $first: "$restaurant.latestInspectionDate" },
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
          ratings: { $push: "$rating" }
        }
      },
      { $sort: { avgRating: -1 } },
      { $limit: 10 }
    ];

    const ratingsData = await reviewsCollection.aggregate(pipeline).toArray();

    // Calculate rating distribution (1-5 stars)
    const processedData = ratingsData.map(restaurant => {
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      restaurant.ratings.forEach(rating => {
        const rounded = Math.round(rating);
        if (rounded >= 1 && rounded <= 5) distribution[rounded]++;
      });

      return {
        _id: restaurant._id,
        restaurantName: restaurant.restaurantName,
        borough: restaurant.borough,
        cuisine: restaurant.cuisine,
        latestGrade: restaurant.latestGrade || 'N/A',
        latestInspectionDate: restaurant.latestInspectionDate,
        avgRating: Math.round(restaurant.avgRating * 100) / 100,
        totalReviews: restaurant.totalReviews,
        ratingDistribution: distribution
      };
    });

    res.json({
      success: true,
      data: processedData,
      filters: { boroughs, cuisines },
      hasData: processedData.length > 0
    });

  } catch (error) {
    console.error("Analytics ratings error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch ratings analytics" });
  }
});

// Get violation trends
router.get("/violations", ensureAuthenticated, async (req, res) => {
  try {
    const inspectionsCollection = await inspections();

    // Violations per year
    const yearlyViolations = await inspectionsCollection.aggregate([
      { $match: { inspectionDate: { $exists: true, $ne: null }, violations: { $exists: true, $ne: [] } } },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } } } },
      { $unwind: "$violations" },
      { $group: { _id: { $year: "$inspectionDateObj" }, totalViolations: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]).toArray();

    // Most common violations
    const commonViolations = await inspectionsCollection.aggregate([
      { $match: { violations: { $exists: true, $ne: [] } } },
      { $unwind: "$violations" },
      { $group: { _id: "$violations.code", violationDescription: { $first: "$violations.description" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    // Average score over time
    const scoreTrend = await inspectionsCollection.aggregate([
      { $match: { inspectionDate: { $exists: true, $ne: null }, score: { $exists: true, $ne: null, $gte: 0 } } },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } } } },
      { $group: { _id: { year: { $year: "$inspectionDateObj" }, month: { $month: "$inspectionDateObj" } }, avgScore: { $avg: "$score" }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).toArray();

    // Grade distribution by year
    const gradeTrend = await inspectionsCollection.aggregate([
      { $match: { inspectionDate: { $exists: true, $ne: null }, grade: { $in: ["a", "b", "c", "A", "B", "C"] } } },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } }, gradeUpper: { $toUpper: "$grade" } } },
      { $group: { _id: { year: { $year: "$inspectionDateObj" }, grade: "$gradeUpper" }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.grade": 1 } }
    ]).toArray();

    // Convert grades to percentages by year
    const gradesByYear = {};
    gradeTrend.forEach(item => {
      const year = item._id.year;
      if (!gradesByYear[year]) gradesByYear[year] = { A: 0, B: 0, C: 0, total: 0 };
      gradesByYear[year][item._id.grade] = item.count;
      gradesByYear[year].total += item.count;
    });

    const gradePercentages = Object.keys(gradesByYear).map(year => ({
      year: parseInt(year),
      grades: {
        A: Math.round((gradesByYear[year].A / gradesByYear[year].total) * 100),
        B: Math.round((gradesByYear[year].B / gradesByYear[year].total) * 100),
        C: Math.round((gradesByYear[year].C / gradesByYear[year].total) * 100)
      },
      total: gradesByYear[year].total
    })).sort((a, b) => a.year - b.year);

    res.json({
      success: true,
      data: {
        yearlyViolations: yearlyViolations.map(item => ({ year: item._id, violations: item.totalViolations })),
        commonViolations: commonViolations.map(item => ({ code: item._id, description: item.violationDescription || `Violation ${item._id}`, count: item.count })),
        scoreTrend: scoreTrend.map(item => ({ year: item._id.year, month: item._id.month, avgScore: Math.round(item.avgScore * 100) / 100, count: item.count })),
        gradeTrend: gradePercentages
      }
    });

  } catch (error) {
    console.error("Analytics violations error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch violation analytics" });
  }
});

export default router;
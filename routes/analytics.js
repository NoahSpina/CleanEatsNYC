import { Router } from "express";
import { restaurants, inspections, reviews, comments } from "../config/mongoCollections.js";
import { checkAndTrimString } from "../helpers/validation.js";
import xss from "xss";

const router = Router();

const ensureAuthenticated = (req, res, next) => {
  if (!req.session?.user) {
    if (req.path !== "/") {
      return res.status(401).json({ success: false, error: "You must be logged in to access this page" });
    }
    return res.status(401).render("error", { title: "Unauthorized", error: "You must be logged in to access this page", user: null });
  }
  next();
};

router.get("/", ensureAuthenticated, (req, res) => {
  res.render("analytics", { title: "Analytics Dashboard", user: req.session.user });
});

router.get("/ratings", ensureAuthenticated, async (req, res) => {
  try {
    const borough = req.query.borough ? xss(req.query.borough) : req.query.borough;
    const cuisine = req.query.cuisine ? xss(req.query.cuisine) : req.query.cuisine;
    const reviewsCollection = await reviews();
    const restaurantsCollection = await restaurants();

    const allRestaurants = await restaurantsCollection.find({}).toArray();
    const boroughs = [...new Set(allRestaurants.map(r => r.borough))].filter(Boolean).sort();
    const cuisines = [...new Set(allRestaurants.map(r => r.cuisine))].filter(Boolean).sort();

    const filter = {};
    if (borough?.trim()) filter["restaurant.borough"] = checkAndTrimString(borough, "borough");
    if (cuisine?.trim()) filter["restaurant.cuisine"] = checkAndTrimString(cuisine, "cuisine");

    const statsPipeline = [
      { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
      { $unwind: "$restaurant" },
      { $match: { rating: { $exists: true, $gte: 1, $lte: 5 } } },
      ...(Object.keys(filter).length > 0 ? [{ $match: filter }] : []),
      {
        $group: {
          _id: null,
          totalReviews: { $sum: 1 },
          avgRating: { $avg: "$rating" },
          minRating: { $min: "$rating" },
          maxRating: { $max: "$rating" },
          totalRestaurants: { $addToSet: "$restaurantId" }
        }
      }
    ];

    const statsData = await reviewsCollection.aggregate(statsPipeline).toArray();
    const stats = statsData.length > 0 ? {
      totalReviews: statsData[0].totalReviews || 0,
      avgRating: statsData[0].avgRating ? Math.round(statsData[0].avgRating * 100) / 100 : 0,
      minRating: statsData[0].minRating ? Math.round(statsData[0].minRating * 100) / 100 : 0,
      maxRating: statsData[0].maxRating ? Math.round(statsData[0].maxRating * 100) / 100 : 0,
      totalRestaurants: statsData[0].totalRestaurants ? statsData[0].totalRestaurants.length : 0
    } : { totalReviews: 0, avgRating: 0, minRating: 0, maxRating: 0, totalRestaurants: 0 };

    const pipeline = [
      { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
      { $unwind: "$restaurant" },
      { $match: { rating: { $exists: true, $gte: 1, $lte: 5 } } },
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
      { $match: { totalReviews: { $gt: 0 } } },
      { $sort: { avgRating: -1 } },
      { $limit: 10 }
    ];

    const ratingsData = await reviewsCollection.aggregate(pipeline).toArray();
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

    res.json({ success: true, data: processedData, stats, filters: { boroughs, cuisines }, hasData: processedData.length > 0 });
  } catch (error) {
    console.error("Analytics ratings error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch ratings analytics" });
  }
});

router.get("/ratings-breakdown", ensureAuthenticated, async (req, res) => {
  try {
    const borough = req.query.borough ? xss(req.query.borough) : req.query.borough;
    const cuisine = req.query.cuisine ? xss(req.query.cuisine) : req.query.cuisine;
    const reviewsCollection = await reviews();
    const filter = {};
    if (borough?.trim()) filter["restaurant.borough"] = checkAndTrimString(borough, "borough");
    if (cuisine?.trim()) filter["restaurant.cuisine"] = checkAndTrimString(cuisine, "cuisine");

    const boroughRatings = await reviewsCollection.aggregate([
      { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
      { $unwind: "$restaurant" },
      { $match: { rating: { $exists: true, $gte: 1, $lte: 5 }, "restaurant.borough": { $exists: true, $ne: null } } },
      ...(filter["restaurant.cuisine"] ? [{ $match: { "restaurant.cuisine": filter["restaurant.cuisine"] } }] : []),
      { $group: { _id: "$restaurant.borough", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      { $sort: { avgRating: -1 } }
    ]).toArray();

    const cuisineRatings = await reviewsCollection.aggregate([
      { $lookup: { from: "restaurants", localField: "restaurantId", foreignField: "_id", as: "restaurant" } },
      { $unwind: "$restaurant" },
      { $match: { rating: { $exists: true, $gte: 1, $lte: 5 }, "restaurant.cuisine": { $exists: true, $ne: null } } },
      ...(filter["restaurant.borough"] ? [{ $match: { "restaurant.borough": filter["restaurant.borough"] } }] : []),
      { $group: { _id: "$restaurant.cuisine", avgRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } },
      { $sort: { avgRating: -1 } },
      { $limit: 15 }
    ]).toArray();

    res.json({
      success: true,
      data: {
        byBorough: boroughRatings.map(item => ({
          borough: item._id.charAt(0).toUpperCase() + item._id.slice(1),
          avgRating: Math.round(item.avgRating * 1000) / 1000,
          totalReviews: item.totalReviews
        })),
        byCuisine: cuisineRatings.map(item => ({
          cuisine: item._id,
          avgRating: Math.round(item.avgRating * 1000) / 1000,
          totalReviews: item.totalReviews
        }))
      }
    });
  } catch (error) {
    console.error("Analytics breakdown error:", error);
    res.status(500).json({ success: false, error: "Failed to fetch ratings breakdown" });
  }
});

router.get("/violations", ensureAuthenticated, async (req, res) => {
  try {
    const borough = req.query.borough ? xss(req.query.borough) : req.query.borough;
    const cuisine = req.query.cuisine ? xss(req.query.cuisine) : req.query.cuisine;
    const inspectionsCollection = await inspections();
    const restaurantsCollection = await restaurants();

    const restaurantFilter = {};
    if (borough?.trim()) restaurantFilter.borough = checkAndTrimString(borough, "borough");
    if (cuisine?.trim()) restaurantFilter.cuisine = checkAndTrimString(cuisine, "cuisine");

    let restaurantIds = [];
    if (Object.keys(restaurantFilter).length > 0) {
      const matchingRestaurants = await restaurantsCollection.find(restaurantFilter, { projection: { _id: 1 } }).toArray();
      restaurantIds = matchingRestaurants.map(r => r._id);
      if (restaurantIds.length === 0) {
        return res.json({ success: true, data: { yearlyViolations: [], commonViolations: [], scoreTrend: [], gradeTrend: [] } });
      }
    }

    const inspectionMatch = { inspectionDate: { $exists: true, $ne: null }, violations: { $exists: true, $ne: [] } };
    if (restaurantIds.length > 0) inspectionMatch.restaurantId = { $in: restaurantIds };

    const yearlyViolations = await inspectionsCollection.aggregate([
      { $match: inspectionMatch },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } } } },
      { $unwind: "$violations" },
      { $group: { _id: { $year: "$inspectionDateObj" }, totalViolations: { $sum: 1 } } },
      { $sort: { "_id": 1 } }
    ]).toArray();

    const commonViolationsMatch = { violations: { $exists: true, $ne: [] } };
    if (restaurantIds.length > 0) commonViolationsMatch.restaurantId = { $in: restaurantIds };
    
    const commonViolations = await inspectionsCollection.aggregate([
      { $match: commonViolationsMatch },
      { $unwind: "$violations" },
      { $group: { _id: "$violations.code", violationDescription: { $first: "$violations.description" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]).toArray();

    const scoreMatch = { inspectionDate: { $exists: true, $ne: null }, score: { $exists: true, $ne: null, $gte: 0 } };
    if (restaurantIds.length > 0) scoreMatch.restaurantId = { $in: restaurantIds };
    
    const scoreTrend = await inspectionsCollection.aggregate([
      { $match: scoreMatch },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } } } },
      { $group: { _id: { year: { $year: "$inspectionDateObj" }, month: { $month: "$inspectionDateObj" } }, avgScore: { $avg: "$score" }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]).toArray();

    const gradeMatch = { inspectionDate: { $exists: true, $ne: null }, grade: { $in: ["a", "b", "c", "A", "B", "C"] } };
    if (restaurantIds.length > 0) gradeMatch.restaurantId = { $in: restaurantIds };
    
    const gradeTrend = await inspectionsCollection.aggregate([
      { $match: gradeMatch },
      { $addFields: { inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } }, gradeUpper: { $toUpper: "$grade" } } },
      { $group: { _id: { year: { $year: "$inspectionDateObj" }, grade: "$gradeUpper" }, count: { $sum: 1 } } },
      { $sort: { "_id.year": 1, "_id.grade": 1 } }
    ]).toArray();

    const gradesByYear = {};
    gradeTrend.forEach(item => {
      const year = item._id.year;
      if (!gradesByYear[year]) gradesByYear[year] = { A: 0, B: 0, C: 0, total: 0 };
      gradesByYear[year][item._id.grade] = item.count;
      gradesByYear[year].total += item.count;
    });

    const gradePercentages = Object.keys(gradesByYear).map(year => {
      const yearData = gradesByYear[year];
      const aPct = Math.round((yearData.A / yearData.total) * 100);
      const bPct = Math.round((yearData.B / yearData.total) * 100);
      const cPct = Math.round((yearData.C / yearData.total) * 100);
      const totalPct = aPct + bPct + cPct;
      let adjustedA = aPct, adjustedB = bPct, adjustedC = cPct;
      
      if (totalPct !== 100) {
        if (aPct >= bPct && aPct >= cPct) {
          adjustedA = 100 - bPct - cPct;
        } else if (bPct >= aPct && bPct >= cPct) {
          adjustedB = 100 - aPct - cPct;
        } else {
          adjustedC = 100 - aPct - bPct;
        }
      }
      
      return {
        year: parseInt(year),
        grades: { A: adjustedA, B: adjustedB, C: adjustedC },
        total: yearData.total
      };
    }).sort((a, b) => b.year - a.year);

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

router.get("/comments", ensureAuthenticated, async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  
  try {
    const borough = req.query.borough ? xss(req.query.borough) : req.query.borough;
    const cuisine = req.query.cuisine ? xss(req.query.cuisine) : req.query.cuisine;
    const restaurantsCollection = await restaurants();
    const reviewsCollection = await reviews();
    
    const restaurantFilter = {};
    if (borough?.trim()) restaurantFilter.borough = checkAndTrimString(borough, "borough");
    if (cuisine?.trim()) restaurantFilter.cuisine = checkAndTrimString(cuisine, "cuisine");
    
    let restaurantIds = [];
    if (Object.keys(restaurantFilter).length > 0) {
      const matchingRestaurants = await restaurantsCollection.find(restaurantFilter, { projection: { _id: 1 } }).toArray();
      restaurantIds = matchingRestaurants.map(r => r._id);
      if (restaurantIds.length === 0) {
        return res.json({ success: true, data: { totalComments: 0, commentsPerReview: null, commentsOverTime: [] }, hasData: false });
      }
    }
    
    let reviewIds = [];
    if (restaurantIds.length > 0) {
      const matchingReviews = await reviewsCollection.find({ restaurantId: { $in: restaurantIds } }, { projection: { _id: 1 } }).toArray();
      reviewIds = matchingReviews.map(r => r._id);
      if (reviewIds.length === 0) {
        return res.json({ success: true, data: { totalComments: 0, commentsPerReview: null, commentsOverTime: [] }, hasData: false });
      }
    }
    
    let commentsCollection;
    try {
      commentsCollection = await comments();
    } catch (err) {
      return res.json({ success: true, data: { totalComments: 0, commentsPerReview: null, commentsOverTime: [] }, hasData: false });
    }

    const commentMatch = {};
    if (reviewIds.length > 0) commentMatch.reviewId = { $in: reviewIds };
    
    let commentCount = 0;
    try {
      commentCount = await commentsCollection.countDocuments(commentMatch);
    } catch (err) {
      return res.json({ success: true, data: { totalComments: 0, commentsPerReview: null, commentsOverTime: [] }, hasData: false });
    }
    
    if (commentCount === 0) {
      return res.json({ success: true, data: { totalComments: 0, commentsPerReview: null, commentsOverTime: [] }, hasData: false });
    }

    let commentsPerReview = [];
    try {
      commentsPerReview = await commentsCollection.aggregate([
        { $match: commentMatch },
        { $group: { _id: "$reviewId", commentCount: { $sum: 1 } } },
        { $group: { _id: null, avgComments: { $avg: "$commentCount" }, maxComments: { $max: "$commentCount" }, minComments: { $min: "$commentCount" } } }
      ]).toArray();
    } catch (err) {
      commentsPerReview = [];
    }

    let commentsOverTime = [];
    try {
      commentsOverTime = await commentsCollection.aggregate([
        { $match: { ...commentMatch, createdAt: { $exists: true } } },
        { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 } } },
        { $sort: { "_id.year": 1, "_id.month": 1 } }
      ]).toArray();
    } catch (err) {
      commentsOverTime = [];
    }

    res.json({
      success: true,
      data: {
        totalComments: commentCount,
        commentsPerReview: commentsPerReview.length > 0 ? {
          avg: Math.round(commentsPerReview[0].avgComments * 100) / 100,
          max: commentsPerReview[0].maxComments,
          min: commentsPerReview[0].minComments
        } : null,
        commentsOverTime: commentsOverTime.map(item => ({ year: item._id.year, month: item._id.month, count: item.count }))
      },
      hasData: true
    });
  } catch (error) {
    console.error("Analytics comments error:", error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json');
      res.status(500).json({ success: false, error: "Failed to fetch comment analytics" });
    }
  }
});

export default router;

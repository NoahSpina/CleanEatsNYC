import { Router } from "express";
import { restaurants, inspections, reviews } from "../config/mongoCollections.js";
import { checkAndTrimString } from "../helpers/validation.js";

const router = Router();

// Authentication middleware
const ensureAuthenticated = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return res.status(401).render("error", {
      title: "Unauthorized",
      error: "You must be logged in to access this page",
      user: null,
    });
  }
  next();
};

// GET /analytics - Main analytics dashboard page
router.get("/", ensureAuthenticated, (req, res) => {
  res.render("analytics", {
    title: "Analytics Dashboard",
    user: req.session.user,
  });
});

// GET /analytics/ratings - JSON endpoint for ratings data
router.get("/ratings", ensureAuthenticated, async (req, res) => {
  try {
    const { borough, cuisine } = req.query;
    
    // Build match stage for filtering
    const matchStage = {};
    if (borough && borough.trim() !== "") {
      matchStage.borough = checkAndTrimString(borough, "borough");
    }
    if (cuisine && cuisine.trim() !== "") {
      matchStage.cuisine = checkAndTrimString(cuisine, "cuisine");
    }

    const reviewsCollection = await reviews();
    const restaurantsCollection = await restaurants();

    // Get all restaurants for filter options (unfiltered)
    const allRestaurants = await restaurantsCollection.find({}).toArray();

    // Aggregate ratings data
    const pipeline = [
      {
        $lookup: {
          from: "restaurants",
          localField: "restaurantId",
          foreignField: "_id",
          as: "restaurant"
        }
      },
      {
        $unwind: "$restaurant"
      }
    ];

    // Add match stage if filters are provided
    if (Object.keys(matchStage).length > 0) {
      const restaurantMatchStage = {};
      Object.keys(matchStage).forEach(key => {
        restaurantMatchStage[`restaurant.${key}`] = matchStage[key];
      });
      pipeline.push({ $match: restaurantMatchStage });
    }

    pipeline.push(
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
      {
        $sort: { avgRating: -1 }
      },
      {
        $limit: 10
      }
    );

    const ratingsData = await reviewsCollection.aggregate(pipeline).toArray();

    // Calculate rating distribution for each restaurant
    const processedData = ratingsData.map(restaurant => {
      const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
      restaurant.ratings.forEach(rating => {
        const roundedRating = Math.round(rating);
        if (roundedRating >= 1 && roundedRating <= 5) {
          distribution[roundedRating]++;
        }
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

    // Get unique boroughs and cuisines for filter options
    const boroughs = [...new Set(allRestaurants.map(r => r.borough))].filter(Boolean).sort();
    const cuisines = [...new Set(allRestaurants.map(r => r.cuisine))].filter(Boolean).sort();

    res.json({
      success: true,
      data: processedData,
      filters: {
        boroughs,
        cuisines
      },
      hasData: processedData.length > 0
    });

  } catch (error) {
    console.error("Analytics ratings error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch ratings analytics"
    });
  }
});

// GET /analytics/violations - JSON endpoint for violation trends
router.get("/violations", ensureAuthenticated, async (req, res) => {
  try {
    const inspectionsCollection = await inspections();

    // Yearly violations trend
    const yearlyPipeline = [
      {
        $match: {
          inspectionDate: { $exists: true, $ne: null },
          violations: { $exists: true, $ne: [] }
        }
      },
      {
        $addFields: {
          inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } }
        }
      },
      {
        $unwind: "$violations"
      },
      {
        $group: {
          _id: { $year: "$inspectionDateObj" },
          totalViolations: { $sum: 1 }
        }
      },
      {
        $sort: { "_id": 1 }
      }
    ];

    // Common violations
    const violationsPipeline = [
      {
        $match: {
          violations: { $exists: true, $ne: [] }
        }
      },
      {
        $unwind: "$violations"
      },
      {
        $group: {
          _id: "$violations.code",
          violationDescription: { $first: "$violations.description" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      }
    ];

    // Score trend over time
    const scorePipeline = [
      {
        $match: {
          inspectionDate: { $exists: true, $ne: null },
          score: { $exists: true, $ne: null, $gte: 0 }
        }
      },
      {
        $addFields: {
          inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$inspectionDateObj" },
            month: { $month: "$inspectionDateObj" }
          },
          avgScore: { $avg: "$score" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }
      }
    ];

    // Grade trend over time
    const gradePipeline = [
      {
        $match: {
          inspectionDate: { $exists: true, $ne: null },
          grade: { $exists: true, $ne: null, $in: ["a", "b", "c", "A", "B", "C"] }
        }
      },
      {
        $addFields: {
          inspectionDateObj: { $dateFromString: { dateString: "$inspectionDate" } },
          gradeUpper: { $toUpper: "$grade" }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$inspectionDateObj" },
            grade: "$gradeUpper"
          },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.year": 1, "_id.grade": 1 }
      }
    ];

    const [yearlyViolations, commonViolations, scoreTrend, gradeTrend] = await Promise.all([
      inspectionsCollection.aggregate(yearlyPipeline).toArray(),
      inspectionsCollection.aggregate(violationsPipeline).toArray(),
      inspectionsCollection.aggregate(scorePipeline).toArray(),
      inspectionsCollection.aggregate(gradePipeline).toArray()
    ]);

    // Process grade trend data for easier consumption
    const gradesByYear = {};
    gradeTrend.forEach(item => {
      const year = item._id.year;
      if (!gradesByYear[year]) {
        gradesByYear[year] = { A: 0, B: 0, C: 0, total: 0 };
      }
      gradesByYear[year][item._id.grade] = item.count;
      gradesByYear[year].total += item.count;
    });

    // Convert to percentage
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
        yearlyViolations: yearlyViolations.map(item => ({
          year: item._id,
          violations: item.totalViolations
        })),
        commonViolations: commonViolations.map(item => ({
          code: item._id,
          description: item.violationDescription || `Violation ${item._id}`,
          count: item.count
        })),
        scoreTrend: scoreTrend.map(item => ({
          year: item._id.year,
          month: item._id.month,
          avgScore: Math.round(item.avgScore * 100) / 100,
          count: item.count
        })),
        gradeTrend: gradePercentages
      }
    });

  } catch (error) {
    console.error("Analytics violations error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch violation analytics"
    });
  }
});

export default router;

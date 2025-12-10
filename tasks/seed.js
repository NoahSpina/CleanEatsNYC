import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import { restaurants, inspections, reviews } from "../config/mongoCollections.js";
import fs from "fs";
import csv from "csv-parser";
import { normalizeString, toDateorNull } from "../helpers/validation.js";
import { ObjectId } from "mongodb";
import { inspectionKey } from "../helpers/seeding.js";

const db = await dbConnection();
console.log("Dropping existing database...");
await db.dropDatabase();

console.log("Reading CSV...");
const restaurantsCollection = await restaurants();
const inspectionsCollection = await inspections();

// Using maps to store entries seen already
const restaurantByCamis = new Map(); // camis -> restaurantDoc
const inspectionsByKey = new Map(); // key -> inspectionDoc draft
const inspectionsPerCamis = new Map(); // camis -> [inspectionDocument]

const stream = fs.createReadStream("data/raw/nyc_inspections.csv").pipe(csv());

for await (const row of stream) {
  try {
    let camisRaw = row["CAMIS"];
    if (!camisRaw) {
      const altKey = Object.keys(row).find(key => key.includes("CAMIS"));
      if (altKey) camisRaw = row[altKey];
    }
    if (!camisRaw) continue;

    const camis = Number(camisRaw);
    const dba = normalizeString(row["DBA"]);
    const boro = normalizeString(row["BORO"]);
    const cuisine = normalizeString(row["CUISINE DESCRIPTION"]);

    const inspectionDateStr = row["INSPECTION DATE"];
    const inspectionDateObj = toDateorNull(inspectionDateStr);

    if (!inspectionDateObj || inspectionDateObj.getFullYear() === 1900)
      continue;

    // "YYYY-MM-DD" string
    const inspectionDate = inspectionDateObj.toISOString().slice(0, 10);
    // Restaurants
    let restaurantDocument = restaurantByCamis.get(camis);
    if (!restaurantByCamis.has(camis)) {
      // New restaurant
      const latStr = row["Latitude"];
      const longStr = row["Longitude"];

      const latitude = latStr ? Number(latStr) : null;
      const longitude = longStr ? Number(longStr) : null;

      restaurantDocument = {
        _id: new ObjectId(),
        camis,
        name: dba,
        borough: boro,
        cuisine,
        address: {
          building: normalizeString(row["BUILDING"]),
          street: normalizeString(row["STREET"]),
          zipcode: normalizeString(row["ZIPCODE"]),
        },
        location:
          latitude && longitude
            ? { type: "Point", coordinates: [longitude, latitude] }
            : null,
        latestGrade: null,
        latestScore: null,
        latestInspectionDate: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        cleanStreakCount: 0,
        hasCleanStreakBadge: false,
      };

      restaurantByCamis.set(camis, restaurantDocument);
      inspectionsPerCamis.set(camis, []);
    }

    // Inspections
    const dateKey = inspectionDate;
    const key = inspectionKey(camis, dateKey);

    let inspection = inspectionsByKey.get(key);
    if (!inspection) {
      // New inspection
      const scoreStr = row["SCORE"];
      const gradeStr = row["GRADE"];

      const score =
        scoreStr != null && scoreStr !== "" ? Number(scoreStr) : null;
      const grade = normalizeString(gradeStr) || null;

      inspection = {
        _id: new ObjectId(),
        restaurantId: restaurantDocument._id,
        inspectionDate,
        grade,
        score,
        violations: [],
      };

      inspectionsByKey.set(key, inspection);
      inspectionsPerCamis.get(camis).push(inspection);
    }

    // Violations
    const violationCode = normalizeString(row["VIOLATION CODE"]);
    const violationDesc = normalizeString(row["VIOLATION DESCRIPTION"]);

    if (violationCode || violationDesc) {
      inspection.violations.push({
        code: violationCode || null,
        description: violationDesc || null,
      });
    }
  } catch (e) {
    console.error(`Error processing row: ${e}`);
  }
}

// latestGrade, latestScore, latestInspectionDate, Streak
for (const [camis, inspectionList] of inspectionsPerCamis) {
  inspectionList.sort((a, b) =>
    b.inspectionDate.localeCompare(a.inspectionDate)
  );
  const latest = inspectionList[0];
  const restaurant = restaurantByCamis.get(camis);
  restaurant.latestGrade = latest.grade;
  restaurant.latestScore = latest.score;
  restaurant.latestInspectionDate = latest.inspectionDate;
  restaurant.updatedAt = new Date();

  let streak = 0;
  for (const inspection of inspectionList) {
    if (
      inspection.grade === "A" &&
      (!inspection.violations || inspection.violations.length <= 1)
    ) {
      streak += 1;
    } else {
      break;
    }
  }
  restaurant.cleanStreakCount = streak;
  restaurant.hasCleanStreakBadge = streak >= 2 ? true : false;
}

const restaurantDocs = Array.from(restaurantByCamis.values());
const inspectionDocs = Array.from(inspectionsByKey.values());

console.log(
  `Prepared ${restaurantDocs.length} restaurants and ${inspectionDocs.length} inspections.`
);

console.log("Inserting restaurants...");
if (restaurantDocs.length) {
  await restaurantsCollection.insertMany(restaurantDocs);
}

console.log("Inserting inspections...");
if (inspectionDocs.length) {
  await inspectionsCollection.insertMany(inspectionDocs);
}

// Add random reviews for all restaurants
console.log("Adding random reviews for restaurants...");
const reviewsCollection = await reviews();

// Sample review texts for variety
const sampleReviewTexts = [
  "Great food and excellent service!",
  "The food was okay, but the service could be better.",
  "Amazing experience! Will definitely come back.",
  "Not bad, but nothing special.",
  "Excellent quality and great atmosphere.",
  "The food was good but a bit pricey.",
  "Outstanding! One of the best meals I've had.",
  "Decent place, would recommend.",
  "The service was slow but the food made up for it.",
  "Perfect for a quick meal.",
  "Great value for money!",
  "The ambiance was nice but the food was average.",
  "Absolutely loved it!",
  "Good food, clean environment.",
  "Could use some improvement in service.",
];

const allRestaurants = await restaurantsCollection.find({}).toArray();
const reviewDocs = [];

for (const restaurant of allRestaurants) {
  // Generate 3-8 random reviews per restaurant
  const numReviews = Math.floor(Math.random() * 6) + 3; // 3 to 8 reviews

  for (let i = 0; i < numReviews; i++) {
    // Random rating between 1 and 5
    const rating = Math.floor(Math.random() * 5) + 1;

    // Random review text
    const reviewText = sampleReviewTexts[Math.floor(Math.random() * sampleReviewTexts.length)];

    // Random date within the last 2 years
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const randomTime = twoYearsAgo.getTime() + Math.random() * (now.getTime() - twoYearsAgo.getTime());
    const createdAt = new Date(randomTime);

    reviewDocs.push({
      _id: new ObjectId(),
      restaurantId: restaurant._id,
      userId: new ObjectId(), // Dummy user ID for seed data
      rating: rating,
      reviewText: reviewText,
      createdAt: createdAt,
      updatedAt: createdAt,
    });
  }
}

if (reviewDocs.length > 0) {
  // Insert reviews in batches to avoid memory issues
  const batchSize = 1000;
  for (let i = 0; i < reviewDocs.length; i += batchSize) {
    const batch = reviewDocs.slice(i, i + batchSize);
    await reviewsCollection.insertMany(batch);
    console.log(`Inserted ${Math.min(i + batchSize, reviewDocs.length)} of ${reviewDocs.length} reviews...`);
  }
  console.log(`Added ${reviewDocs.length} reviews for ${allRestaurants.length} restaurants.`);
}


console.log("Seeding completed!");
await closeConnection();

import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import { restaurants, inspections, reviews, users, comments } from "../config/mongoCollections.js";
import fs from "fs";
import csv from "csv-parser";
import { normalizeString, toDateorNull } from "../helpers/validation.js";
import { ObjectId } from "mongodb";
import { inspectionKey } from "../helpers/seeding.js";
import bcrypt from "bcrypt";

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

// Function to generate review titles based on rating
function getRandomReviewTitle(rating) {
  const excellentTitles = [
    "Outstanding Experience!",
    "Absolutely Amazing!",
    "Perfect in Every Way",
    "Best Meal Ever!",
    "Five Stars All Around",
    "Exceeded Expectations",
    "Incredible Food & Service",
    "Will Definitely Return!"
  ];
  
  const goodTitles = [
    "Really Good Food",
    "Great Experience",
    "Solid Choice",
    "Worth the Visit",
    "Pretty Good Overall",
    "Nice Place",
    "Good Quality Food",
    "Enjoyed Our Meal"
  ];
  
  const averageTitles = [
    "It Was Okay",
    "Average Experience",
    "Nothing Special",
    "Decent Enough",
    "Could Be Better",
    "Mixed Feelings",
    "Not Bad, Not Great",
    "Mediocre at Best"
  ];
  
  const poorTitles = [
    "Disappointing",
    "Not Worth It",
    "Poor Service",
    "Expected Better",
    "Won't Be Back",
    "Needs Improvement",
    "Not Impressed",
    "Below Average"
  ];
  
  let titleArray;
  if (rating >= 4.5) {
    titleArray = excellentTitles;
  } else if (rating >= 3.5) {
    titleArray = goodTitles;
  } else if (rating >= 2.5) {
    titleArray = averageTitles;
  } else {
    titleArray = poorTitles;
  }
  
  return titleArray[Math.floor(Math.random() * titleArray.length)];
}


console.log("Creating admin user");
const usersCollection = await users();

const adminPassword = await bcrypt.hash("admin123", 12);
const adminUser = {
  _id: new ObjectId(),
  role: "admin",
  username: "admin",
  email: "admin@cleaneats.com",
  displayName: "Admin User",
  hashedPassword: adminPassword,
  favorites: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  lastLoginAt: null,
};

await usersCollection.insertOne(adminUser);
console.log("Admin user created: username=admin, password=admin123");

console.log("Creating basic users...");
const basicUsers = [];
const userNames = [
  { username: "john_doe", displayName: "John Doe", email: "john@example.com" },
  { username: "jane_smith", displayName: "Jane Smith", email: "jane@example.com" },
  { username: "mike_wilson", displayName: "Mike Wilson", email: "mike@example.com" },
  { username: "sarah_johnson", displayName: "Sarah Johnson", email: "sarah@example.com" },
  { username: "david_brown", displayName: "David Brown", email: "david@example.com" },
  { username: "lisa_davis", displayName: "Lisa Davis", email: "lisa@example.com" },
  { username: "tom_miller", displayName: "Tom Miller", email: "tom@example.com" },
  { username: "amy_garcia", displayName: "Amy Garcia", email: "amy@example.com" },
  { username: "chris_martinez", displayName: "Chris Martinez", email: "chris@example.com" },
  { username: "emma_lopez", displayName: "Emma Lopez", email: "emma@example.com" }
];

const userPassword = await bcrypt.hash("password123", 12);

for (const userData of userNames) {
  const user = {
    _id: new ObjectId(),
    role: "user",
    username: userData.username,
    email: userData.email,
    displayName: userData.displayName,
    hashedPassword: userPassword,
    favorites: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastLoginAt: null,
  };
  basicUsers.push(user);
}

await usersCollection.insertMany(basicUsers);
console.log(`Created ${basicUsers.length} basic users with password: password123`);

console.log("Adding random reviews for restaurants...");
const allRestaurants = await restaurantsCollection.find({}).toArray();
const allUsers = [...basicUsers];
const reviewDocs = [];

for (const restaurant of allRestaurants) {
  // Generate 3-8 random reviews per restaurant
  const numReviews = Math.floor(Math.random() * 6) + 3; // 3 to 8 reviews

  for (let i = 0; i < numReviews; i++) {
    // Random rating between 1 and 5
    const rating = Math.floor(Math.random() * 5) + 1;

    // Random review text
    const reviewText = sampleReviewTexts[Math.floor(Math.random() * sampleReviewTexts.length)];

    const randomUser = allUsers[Math.floor(Math.random() * allUsers.length)];

    // Random date within the last 2 years
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
    const randomTime = twoYearsAgo.getTime() + Math.random() * (now.getTime() - twoYearsAgo.getTime());
    const createdAt = new Date(randomTime);

    reviewDocs.push({
      _id: new ObjectId(),
      restaurantId: restaurant._id,
      userId: randomUser._id,
      rating: rating,
      title: getRandomReviewTitle(rating),
      body: reviewText,
      photos: [],
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
  }
  console.log(`Added ${reviewDocs.length} reviews for ${allRestaurants.length} restaurants.`);
}
// Add simple comments on reviews
console.log("Adding comments on reviews...");
const commentsCollection = await comments();

// Simple comment texts
const sampleComments = [
  "Totally agree!",
  "Thanks for sharing.",
  "Same experience here.",
  "Good to know.",
  "Will check it out.",
  "Noted!",
  "Helpful review.",
  "Thanks!",
  "Agreed.",
  "Good point."
];

const allReviews = await reviewsCollection.find({}).toArray();
const commentDocs = [];

// Add 1-3 comments per review (randomly)
for (const review of allReviews) {
  const numComments = Math.floor(Math.random() * 3) + 1; // 1 to 3 comments
  
  for (let i = 0; i < numComments; i++) {
    const commentText = sampleComments[Math.floor(Math.random() * sampleComments.length)];
    
    // Random date after review was created
    const reviewDate = review.createdAt;
    const now = new Date();
    const randomTime = reviewDate.getTime() + Math.random() * (now.getTime() - reviewDate.getTime());
    const createdAt = new Date(randomTime);
    
    commentDocs.push({
      _id: new ObjectId(),
      reviewId: review._id,
      userId: allUsers[Math.floor(Math.random() * allUsers.length)]._id, 
      body: commentText,
      createdAt: createdAt,
      updatedAt: createdAt
    });
  }
}

if (commentDocs.length > 0) {
  // Insert comments in batches
  const batchSize = 1000;
  for (let i = 0; i < commentDocs.length; i += batchSize) {
    const batch = commentDocs.slice(i, i + batchSize);
    await commentsCollection.insertMany(batch);
  }
  console.log(`Added ${commentDocs.length} comments on reviews.`);
}

console.log("Seeding completed!");
await closeConnection();

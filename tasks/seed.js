import { dbConnection, closeConnection } from "../config/mongoConnection.js";
import { restaurants, inspections } from "../config/mongoCollections.js";
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
    const camisRaw = row["CAMIS"];
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
    let restaurantDocument = restaurantByCamis;
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

console.log("Seeding completed!");
await closeConnection();

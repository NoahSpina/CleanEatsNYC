# Project Overview

CleanEats NYC is a web application that allows users to explore New York City restaurants based on official Department of Health inspection data. Users can search for restaurants, view cleanliness ratings, and read or submit reviews from other users. The app aims to promote transparency in public health data and help residents make informed dining choices.

## Core Features (Must-Have)

1. Search and filter restaurants by borough, cuisine type, or inspection grade.
2. Interactive list view with markers for restaurants and their cleanliness ratings.
3. Profile management and settings.
4. Review system (one review per restaurant per user).
5. Data analytics dashboard showing average ratings and violation trends.
6. Users can sort restaurants based on rating, latest grade, and latest inspection date.
7. Users can favorite restaurants which will appear on their profile page (users can also remove restaurants from favorites).
8. Image uploads for user-submitted restaurant photos to show up in reviews.
9. Users will be able to comment on other users’ reviews.
10. An admin feature will be implemented where admins can update, add, or remove restaurants.

## Extra Features (Nice-to-Have)

1. Geolocation-based recommendations ('Restaurants near me').
2. Users should be able to compare 2-3 restaurants simultaneously, side-by-side.
3. Users should get updates when they log in to show if any of their ‘favorited’ restaurants received new health inspections.
4. Restaurants that have had no violations and an A grade for their last 3 inspections should have a badge that shows off their clean streak.
5. There could be a page that allows users to select individual/multiple violations and a list of restaurants that have that/those violations.

## Dataset Details

**Dataset**: NYC Restaurant Inspection Results

**Source**: NYC Open Data

**URL**: https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data

**Key Fields**: CAMIS (restaurant ID), DBA (name), BORO (borough), CUISINE DESCRIPTION, INSPECTION DATE, SCORE, GRADE, VIOLATION CODE/DESCRIPTION.

The dataset provides public health inspection information for restaurants in NYC, including violations and grades. CleanEats uses this data to generate searchable results, summaries, and maps of restaurant cleanliness.

## Technology Stack

**Frontend**: Handlebars, custom CSS, client-side JavaScript with AJAX.

**Backend**: Node.js with Express for routing and business logic.

**Database**: MongoDB for user accounts, reviews, and cached restaurant data.

**Security**: Input validation (client, route, DB), XSS defense, password hashing.

**Tools**: GitHub for collaboration

# Setup

1. Clone repo `git clone https://github.com/NoahSpina/CleanEatsNYC`
2. Download csv of [NYC Inspection Data](https://data.cityofnewyork.us/Health/DOHMH-New-York-City-Restaurant-Inspection-Results/43nn-pn8j/about_data)
3. Drag file into this path: CleanEatsNYC/data/raw
4. Start mongo
5. In terminal, run `npm run seed`

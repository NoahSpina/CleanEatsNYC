import express from "express";
import { engine } from "express-handlebars";
import session from "express-session";
import configRoutes from "./routes/index.js";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
    layoutsDir: "./views/layouts/",
    helpers: {
      eq: (a, b) => a === b,
      ne: (a, b) => a !== b,
      or: (a, b, c) => a || b || c,
    },
  })
);
app.set("view engine", "handlebars");
app.set("views", "./views");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/public", express.static("public"));

app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

app.use(
  session({
    name: "AuthCookie",
    secret: "some secret string for now",
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24,
    },
  })
);

app.use((req, res, next) => {
  const timestamp = new Date().toUTCString();
  const method = req.method;
  const route = req.originalUrl;
  const authenticated = req.session?.user
    ? "(Authenticated User)"
    : "(Non-Authenticated User)";

  console.log(`[${timestamp}]: ${method} ${route} ${authenticated}`);
  next();
});

app.use("/restaurants", (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/");
  }
  next();
});

configRoutes(app);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log("Your routes will be running on http://localhost:3000");
});

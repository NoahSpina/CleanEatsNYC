import authRoutes from "./auth.js";
import restaurantRoutes from "./restaurants.js";

const constructorMethod = (app) => {
  app.use((req, res, next) => {
    // this makes the user avalailable for all views
    res.locals.user = req.session?.user || null;
    next();
  });

  // auth routes: /login, /register, /logout
  app.use("/", authRoutes);

  // home page
  app.get("/", (req, res) => {
    res.render("home", {
      title: "CleanEats NYC",
      user: req.session?.user || null,
    });
  });

  // restaurant routes: /restaurants, /restaurants/:id
  app.use("/", restaurantRoutes);

  app.use("*splat", (req, res) => {
    res.status(404).render("error", {
      title: "404 - Page Not Found",
      error: "Page not found",
      user: req.session?.user || null,
    });
  });
};

export default constructorMethod;

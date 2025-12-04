import authRoutes from "./auth.js";

const constructorMethod = (app) => {
  app.use("/", authRoutes);

  app.get("/", (req, res) => {
    res.render("home", {
      title: "CleanEats NYC",
      user: req.session?.user || null,
    });
  });

  app.use((req, res) => {
    res.status(404).render("error", {
      title: "404 - Page Not Found",
      error: "Page not found",
      user: req.session?.user || null,
    });
  });
};

export default constructorMethod;


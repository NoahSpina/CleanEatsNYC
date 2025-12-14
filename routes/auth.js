import { Router } from "express";
import userData from "../data/users.js";
import xss from "xss";

const router = Router();

const redirectIfLoggedIn = (req, res, next) =>
  req.session?.user ? res.redirect("/") : next();

const renderError = (res, view, error, extra = {}) =>
  res.status(view === "login" ? 401 : 400).render(view, {
    title: view[0].toUpperCase() + view.slice(1),
    error,
    ...extra
  });

// REGISTER
router.get("/register", redirectIfLoggedIn, (req, res) => {
  res.render("register", { title: "Register" });
});

router.post("/register", async (req, res) => {
  const { username, displayName, email, password, confirmPassword } = req.body;
  
  try {
    const newUser = await userData.registerUser(
      username,
      email,
      password,
      displayName,
      confirmPassword
    );
    req.session.user = newUser;
    res.redirect("/");
  } catch (e) {
    const safeUsername = username ? xss(username) : username;
    const safeDisplayName = displayName ? xss(displayName) : displayName;
    const safeEmail = email ? xss(email) : email;
    renderError(res, "register", e.message, { username: safeUsername, displayName: safeDisplayName, email: safeEmail });
  }
});

// LOGIN
router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("login", { title: "Login" });
});

router.post("/login", async (req, res) => {
  const { emailOrUsername, password } = req.body;

  try {
    req.session.user = await userData.loginUser(emailOrUsername, password);
    res.redirect("/");
  } catch (e) {
    const safeEmailOrUsername = emailOrUsername ? xss(emailOrUsername) : emailOrUsername;
    renderError(res, "login", e.message, { emailOrUsername: safeEmailOrUsername });
  }
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.session?.destroy(() => res.redirect("/"));
});

export default router;

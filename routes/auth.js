import { Router } from "express";
import userData from "../data/users.js";
import xss from "xss";
import { validateUsername, validateDisplayName, validateEmail, validatePassword, validatePasswordMatch, checkAndTrimString } from "../helpers/validation.js";

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
  
  let cleanUsername = xss(username);
  let cleanDisplayName = xss(displayName);
  let cleanEmail = xss(email);

  try {
    cleanUsername = validateUsername(cleanUsername);
    cleanDisplayName = validateDisplayName(cleanDisplayName);
    cleanEmail = validateEmail(cleanEmail);
    validatePassword(password);
    validatePasswordMatch(password, confirmPassword);
  } catch (e) {
    return renderError(res, "register", e.message, { username: cleanUsername, displayName: cleanDisplayName, email: cleanEmail });
  }

  try {
    const newUser = await userData.registerUser(
      cleanUsername,
      cleanEmail,
      password, // Don't think we need to XSS the password
      cleanDisplayName,
      confirmPassword 
    );
    req.session.user = newUser;
    res.redirect("/");
  } catch (e) {
    renderError(res, "register", e.message, { username: cleanUsername, displayName: cleanDisplayName, email: cleanEmail });
  }
});

// LOGIN
router.get("/login", redirectIfLoggedIn, (req, res) => {
  res.render("login", { title: "Login" });
});

router.post("/login", async (req, res) => {
  const { emailOrUsername, password } = req.body;
  let cleanEmailOrUsername = xss(emailOrUsername);

  try {
    cleanEmailOrUsername = checkAndTrimString(cleanEmailOrUsername, "email or username");
    checkAndTrimString(password, "password");
  } catch (e) {
    return renderError(res, "login", e.message, { emailOrUsername: cleanEmailOrUsername });
  }

  try {
    req.session.user = await userData.loginUser(cleanEmailOrUsername, password);
    res.redirect("/");
  } catch (e) {
    renderError(res, "login", e.message, { emailOrUsername: cleanEmailOrUsername });
  }
});

// LOGOUT
router.get("/logout", (req, res) => {
  req.session?.destroy(() => res.redirect("/"));
});

export default router;

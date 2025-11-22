const V = {
  displayName(name) {
    name = name?.trim();
    if (!name) return ["Display name required"];
    if (name.length < 2) return ["Display name too short"];
    if (name.length > 50) return ["Display name too long"];
    if (!/^[a-zA-Z0-9\s\-'.]+$/.test(name)) return ["Invalid characters in display name"];
    if (/<[^>]*>/.test(name)) return ["Display name cannot contain HTML tags"];
    return [];
  },
  email(e) {
    e = e?.trim();
    if (!e) return ["Email required"];
    if (/<[^>]*>/.test(e)) return ["Email cannot contain HTML tags"];
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? [] : ["Invalid email"];
  },
  show(id, errors) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = errors[0] || "";
    el.style.display = errors.length ? "block" : "none";
  }
};

function bind(fieldId, errorId, validate) {
  const el = document.getElementById(fieldId);
  if (!el) return () => [];
  el.addEventListener("blur", () => V.show(errorId, validate(el.value)));
  el.addEventListener("focus", () => V.show(errorId, []));
  return () => validate(el.value);
}

function setupProfileEdit() {
  const f = document.getElementById("editProfileForm");
  if (!f) return;

  const checkName = bind("displayName", "displayNameErrors", V.displayName);
  const checkEmail = bind("email", "emailErrors", V.email);

  f.addEventListener("submit", e => {
    const errs = [...checkName(), ...checkEmail()];
    if (errs.length) {
      e.preventDefault();
      errs.forEach(err => {
        if (err.includes("Display name")) V.show("displayNameErrors", [err]);
        if (err.includes("Email")) V.show("emailErrors", [err]);
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupProfileEdit();
});


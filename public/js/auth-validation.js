// Simple browser-side validation helpers
const V = {
    email(e) {
      e = e?.trim();
      return !e ? ["Email required"] : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? [] : ["Invalid email"];
    },
    username(u) {
      u = u?.trim();
      if (!u) return ["Username required"];
      if (u.length < 3) return ["Username too short"];
      if (!/^[a-zA-Z0-9_]+$/.test(u)) return ["Invalid username"];
      return [];
    },
    password(p) {
      p = p?.trim();
      if (!p) return ["Password required"];
      const err = [];
      if (p.length < 6) err.push("Password too short");
      if (!/[a-zA-Z]/.test(p)) err.push("Must include a letter");
      if (!/[0-9]/.test(p)) err.push("Must include a number");
      return err;
    },
    match(p, c) {
      if (!c?.trim()) return ["Confirm your password"];
      return p === c ? [] : ["Passwords do not match"];
    },
    show(id, errors) {
      const el = document.getElementById(id);
      if (!el) return;
      el.textContent = errors[0] || "";
      el.style.display = errors.length ? "block" : "none";
    }
  };
  
  // Attach validation to one field
  function bind(fieldId, errorId, validate) {
    const el = document.getElementById(fieldId);
    if (!el) return () => [];
    el.addEventListener("blur", () => V.show(errorId, validate(el.value)));
    el.addEventListener("focus", () => V.show(errorId, []));
    return () => validate(el.value);
  }
  
  // LOGIN FORM
  function setupLogin() {
    const f = document.getElementById("loginForm");
    if (!f) return;
  
    const checkUser = bind("emailOrUsername", "emailOrUsernameErrors", v =>
      v.includes("@") ? V.email(v) : V.username(v)
    );
    const checkPass = bind("password", "passwordErrors", V.password);
  
    f.addEventListener("submit", e => {
      const errs = [...checkUser(), ...checkPass()];
      if (errs.length) e.preventDefault();
    });
  }
  
  // REGISTER FORM
  function setupRegister() {
    const f = document.getElementById("registerForm");
    if (!f) return;
  
    const u = bind("username", "usernameErrors", V.username);
    const d = bind("displayName", "displayNameErrors", v => (v?.trim().length < 2 ? ["Display name too short"] : []));
    const eVal = bind("email", "emailErrors", V.email);
    const p = bind("password", "passwordErrors", V.password);
    const cp = bind("confirmPassword", "confirmPasswordErrors", () =>
      V.match(document.getElementById("password").value, document.getElementById("confirmPassword").value)
    );
  
    f.addEventListener("submit", e => {
      const errs = [...u(), ...d(), ...eVal(), ...p(), ...cp()];
      if (errs.length) e.preventDefault();
    });
  }
  
  document.addEventListener("DOMContentLoaded", () => {
    setupLogin();
    setupRegister();
  });
  
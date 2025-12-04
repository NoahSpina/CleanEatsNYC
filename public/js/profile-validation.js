function validateDisplayName(name) {
  if (!name || name.trim().length < 2) return ["Display name too short"];
  if (name.length > 50) return ["Display name too long"];
  if (/<[^>]*>/.test(name)) return ["Display name cannot contain HTML tags"];
  return [];
}

function validateEmail(email) {
  if (!email) return ["Email required"];
  if (/<[^>]*>/.test(email)) return ["Email cannot contain HTML tags"];
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ["Invalid email"];
  return [];
}

function showError(id, errors) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = errors[0] || "";
  el.style.display = errors.length ? "block" : "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("editProfileForm");
  if (!form) return;

  const nameInput = document.getElementById("displayName");
  const emailInput = document.getElementById("email");

  nameInput?.addEventListener("blur", () => showError("displayNameErrors", validateDisplayName(nameInput.value)));
  emailInput?.addEventListener("blur", () => showError("emailErrors", validateEmail(emailInput.value)));

  form.addEventListener("submit", (e) => {
    const nameErrs = validateDisplayName(nameInput.value);
    const emailErrs = validateEmail(emailInput.value);
    if (nameErrs.length || emailErrs.length) {
      e.preventDefault();
      showError("displayNameErrors", nameErrs);
      showError("emailErrors", emailErrs);
    }
  });
});


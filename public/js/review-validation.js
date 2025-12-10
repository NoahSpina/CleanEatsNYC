const RV = {
    rating(v) {
        if (!v) return ["Rating is required"];
        const n = Number(v);
        if (!Number.isInteger(n) || n < 1 || n > 5) return ["Rating must be between 1 and 5"];
        return [];
    },
    title(t) {
        t = t?.trim();
        if (!t) return ["Title is required"];
        if (t.length > 80) return ["Title must be 80 characters or fewer"];

        return RV.noHTML(t);
    },
    body(b) {
        b = b?.trim();
        if (!b) return ["Review body is required"];
        if (b.length > 2000) return ["Review must be 2000 characters or fewer"];

        return RV.noHTML(b);
    },
    photoDescriptions(descText, expectedCount) {
        if (!descText && expectedCount > 0) return ["Photo descriptions are required when photos are uploaded"];
        if (!descText?.trim() && expectedCount > 0) return ["Photo descriptions cannot be empty"];

        const lines = descText.split("\n").map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length !== expectedCount) return [`You uploaded ${expectedCount} photos but provided ${lines.length} descriptions`];

        for (const line of lines) {
            const err = RV.noHTML(line);
            if (err.length) return err;
        }

        return [];
    },
    photos(files) {
        if (!files || files.length === 0) return [];
        const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
        const errors = [];
        for (const f of files) {
            if (!allowed.includes(f.type)) {
                errors.push(`Invalid file type: ${f.name}`);
            }
            if (f.size > 5 * 1024 * 1024) {
                errors.push(`File too large (max 5 MB): ${f.name}`);
            }
        }

        return errors;
    },

    noHTML(str) {
        if (/<[^>]*>/.test(str)) return ["HTML tags are not allowed"];
        return [];
    }
};

document.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("write-review-btn");
    const form = document.getElementById("review-form");

    if (btn && form) {
        btn.addEventListener("click", () => {
            const style = window.getComputedStyle(form);
            if (form.style.display === "none" || form.style.display === "") {
                form.style.display = "block";
                btn.textContent = "Hide Review Form";
            } else {
                form.style.display = "none";
                btn.textContent = "Write a Review";
            }
        });
    }

    if (!form) return;
    const errorBox = document.createElement("div");
    errorBox.id = "review-errors";
    errorBox.style.color = "red";
    errorBox.style.marginBottom = "1rem";
    form.prepend(errorBox);

    form.addEventListener("submit", (e) => {
        errorBox.innerHTML = "";
        const errors = [];

        const rating = form.rating.value;
        const title = form.title.value;
        const body = form.body.value;
        const photos = form.photos.files;
        const descriptions = form.photoDescriptions.value;

        errors.push(...RV.rating(rating));
        errors.push(...RV.title(title));
        errors.push(...RV.body(body));
        errors.push(...RV.photos(photos));
        errors.push(...RV.photoDescriptions(descriptions, photos.length));

        if (errors.length > 0) {
            e.preventDefault();
            const list = errors.map(e => `<li>${e}</li>`).join("");
            errorBox.innerHTML = `<ul>${list}</ul>`;
            window.scrollTo({ top: form.offsetTop - 100, behavior: "smooth" });
        }
    });
});
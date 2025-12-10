document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".delete-review-btn");

  buttons.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const restaurantId = btn.dataset.restaurant;

      if (!confirm("Are you sure you want to delete this review?")) return;

      const res = await fetch(`/review/${restaurantId}`, {
        method: "DELETE"
      });

      const data = await res.json();
      if (data.success) {
        window.location.reload(); 
      } else {
        alert("Error deleting review: " + data.error);
      }
    });
  });
});
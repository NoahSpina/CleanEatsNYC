$(document).ready(function () {

  $(".comment-form").on("submit", async function (e) {
    e.preventDefault();

    const reviewId = $(this).data("review");
    const body = $(this).find("textarea").val().trim();
    if (!body) return;
    await fetch(`/comment/${reviewId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    location.reload();
  });

  $(".delete-comment-btn").on("click", async function () {
    const commentId = $(this).data("comment");
    if (!confirm("Delete this comment?")) return;

    try {
      const res = await fetch(`/comment/${commentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" }
      });

      const data = await res.json();
      console.log(data);

      if (data.success) {
        location.reload();
      } else {
        alert("Failed to delete comment: " + data.error);
      }
    } catch (e) {
      console.error(e);
      alert("An error occurred while deleting the comment.");
    }
  });

});
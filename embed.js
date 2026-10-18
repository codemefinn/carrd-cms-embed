(function () {
  const script = document.currentScript;
  const blogId = script?.dataset.blogId;

  if (!blogId) {
    console.error("[Carrd CMS] Missing data-blog-id.");
    return;
  }

  const SUPABASE_URL = "https://zzgcmdtyfjndfvwfguwh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_c6vtRVBqocB6vyOjlyG1tg_3aMfdAYx";

  const container = document.getElementById("my-cms-posts");

  if (!container) {
    console.error("[Carrd CMS] Missing #my-cms-posts element.");
    return;
  }

  container.textContent = "Loading posts...";

  const endpoint = new URL(
    "/rest/v1/posts",
    SUPABASE_URL
  );

  endpoint.searchParams.set("select", "id,title,excerpt,published_at");
  endpoint.searchParams.set("blog_id", "eq." + blogId);
  endpoint.searchParams.set("status", "eq.published");
  endpoint.searchParams.set("order", "published_at.desc");

  fetch(endpoint, {
    headers: {
      apikey: SUPABASE_KEY
    }
  })
    .then(response => {
      if (!response.ok) {
        throw new Error("Failed to load posts: " + response.status);
      }
      return response.json();
    })
    .then(posts => {
      container.replaceChildren();

      if (!posts.length) {
        container.textContent = "No published posts yet.";
        return;
      }

      posts.forEach(post => {
        const article = document.createElement("article");
        const heading = document.createElement("h3");
        const excerpt = document.createElement("p");

        heading.textContent = post.title || "Untitled";
        excerpt.textContent = post.excerpt || "";

        article.append(heading, excerpt);
        container.appendChild(article);
      });
    })
    .catch(error => {
      console.error("[Carrd CMS]", error);
      container.textContent = "Unable to load posts.";
    });
})();

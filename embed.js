(function () {
  const script = document.currentScript;
  const blogId = script?.dataset.blogId;
  const container = document.getElementById("my-cms-posts");

  const FUNCTION_URL =
    "https://zzgcmdtyfjndfvwfguwh.supabase.co/functions/v1/get-blog-posts";
  const SUPABASE_KEY =
    "sb_publishable_c6vtRVBqocB6vyOjlyG1tg_3aMfdAYx";

  if (!blogId || !container) {
    console.error("[Carrd CMS] Missing blog ID or container.");
    return;
  }

  async function loadPosts() {
    container.textContent = "Loading posts...";

    const endpoint = new URL(FUNCTION_URL);
    endpoint.searchParams.set("blog_id", blogId);

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || "Failed to load posts.");
    }

    const posts = result.posts || [];
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
  }

  loadPosts().catch(error => {
    console.error("[Carrd CMS]", error);
    container.textContent =
      "Unable to load posts. Please check your website connection.";
  });
})();

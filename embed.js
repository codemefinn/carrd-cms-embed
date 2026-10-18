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

  const currentOrigin = window.location.origin;

  async function loadPosts() {
    container.textContent = "Checking website...";

    // 1. Check the registered website URL.
    const blogEndpoint = new URL(
      "/rest/v1/blogs",
      SUPABASE_URL
    );

    blogEndpoint.searchParams.set("select", "id,site_url");
    blogEndpoint.searchParams.set("id", "eq." + blogId);

    const blogResponse = await fetch(blogEndpoint, {
      headers: {
        apikey: SUPABASE_KEY
      }
    });

    if (!blogResponse.ok) {
      throw new Error("Unable to verify website.");
    }

    const blogs = await blogResponse.json();
    const blog = blogs[0];

    if (!blog || !blog.site_url) {
      throw new Error("No registered website found.");
    }

    let registeredOrigin;

    try {
      registeredOrigin = new URL(blog.site_url).origin;
    } catch {
      throw new Error("Invalid registered website URL.");
    }

    // 2. Only allow the registered website.
    if (currentOrigin !== registeredOrigin) {
      container.textContent =
        "This website is not registered for this blog.";
      return;
    }

    // 3. Load published posts.
    container.textContent = "Loading posts...";

    const postsEndpoint = new URL(
      "/rest/v1/posts",
      SUPABASE_URL
    );

    postsEndpoint.searchParams.set(
      "select",
      "id,title,excerpt,published_at"
    );
    postsEndpoint.searchParams.set("blog_id", "eq." + blogId);
    postsEndpoint.searchParams.set("status", "eq.published");
    postsEndpoint.searchParams.set("order", "published_at.desc");

    const postsResponse = await fetch(postsEndpoint, {
      headers: {
        apikey: SUPABASE_KEY
      }
    });

    if (!postsResponse.ok) {
      throw new Error("Failed to load posts.");
    }

    const posts = await postsResponse.json();
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

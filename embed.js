(function initCarrdCMS() {
  const script = document.currentScript;
  const blogId = script?.dataset.blogId;

  if (!blogId) {
    console.error("[Carrd CMS] Missing data-blog-id.");
    return;
  }

  const SUPABASE_URL = "https://zzgcmdtyfjndfvwfguwh.supabase.co";
  const SUPABASE_KEY = "sb_publishable_c6vtRVBqocB6vyOjlyG1tg_3aMfdAYx";
  const PAGE_SIZE = 8;

  const gallery = document.getElementById("gallery01");
  const articleTitle = document.getElementById("text01");
  const articleDate = document.getElementById("text03");
  const articleContent = document.getElementById("text02");

  if (!gallery) {
    console.error("[Carrd CMS] Missing #gallery01.");
    return;
  }

  const list = gallery.querySelector("ul");
  const template = list?.querySelector("li");

  if (!list || !template) {
    console.error("[Carrd CMS] Missing Gallery list template.");
    return;
  }

  const currentOrigin = window.location.origin;

  async function fetchRows(table, params) {
    const endpoint = new URL(
      "/rest/v1/" + table,
      SUPABASE_URL
    );

    Object.entries(params).forEach(([key, value]) => {
      endpoint.searchParams.set(key, value);
    });

    const response = await fetch(endpoint, {
      headers: {
        apikey: SUPABASE_KEY
      }
    });

    if (!response.ok) {
      throw new Error(
        `Failed to load ${table}: HTTP ${response.status}`
      );
    }

    return response.json();
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    });
  }

  function getArticleUrl(postId) {
    const url = new URL(window.location.href);

    url.search = "";
    url.searchParams.set("post", postId);
    url.hash = "article";

    return url.toString();
  }

  async function verifyWebsite() {
    const blogs = await fetchRows("blogs", {
      select: "id,site_url",
      id: "eq." + blogId,
      limit: "1"
    });

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

    if (currentOrigin !== registeredOrigin) {
      throw new Error(
        "This website is not registered for this blog."
      );
    }
  }

  async function loadArticle(postId) {
    const rows = await fetchRows("posts", {
      select: "id,title,content,published_at",
      id: "eq." + postId,
      blog_id: "eq." + blogId,
      status: "eq.published",
      limit: "1"
    });

    const post = rows[0];

    if (!post) {
      throw new Error("Published article not found.");
    }

    if (!articleTitle || !articleDate || !articleContent) {
      throw new Error(
        "Missing article elements: text01, text02 or text03."
      );
    }

    articleTitle.textContent = post.title || "";
    articleDate.textContent = formatDate(post.published_at);
    articleContent.textContent = post.content || "";
  }

  async function loadPosts() {
    const posts = await fetchRows("posts", {
      select:
        "id,title,excerpt,published_at,cover_image_url",
      blog_id: "eq." + blogId,
      status: "eq.published",
      order: "published_at.desc",
      limit: String(PAGE_SIZE)
    });

    // Keep the original Carrd <li> as a template.
    const cardTemplate = template.cloneNode(true);
    list.replaceChildren();

    if (!posts.length) {
      list.textContent = "No published posts yet.";
      return;
    }

    posts.forEach(post => {
      const item = cardTemplate.cloneNode(true);
      const link = item.querySelector("a.thumbnail");
      const image = item.querySelector("img");
      const frame = item.querySelector(".frame");
      const caption = item.querySelector(".caption p");

      if (link) {
        link.href = getArticleUrl(post.id);
      }

      if (image) {
        image.alt = post.title || "";

        if (post.cover_image_url) {
          image.src = post.cover_image_url;
          image.hidden = false;
        } else {
          image.removeAttribute("src");
          image.hidden = true;

          if (frame) frame.hidden = true;
        }
      }

      if (caption) {
        caption.replaceChildren();

        const title = document.createElement("strong");
        title.textContent = post.title || "Untitled";

        const date = document.createElement("sub");
        date.textContent = formatDate(post.published_at);

        const dateSpan = document.createElement("span");
        dateSpan.style.color = "#555555";
        dateSpan.append(date);

        caption.append(
          title,
          document.createElement("br"),
          dateSpan,
          document.createElement("br"),
          document.createTextNode(post.excerpt || "")
        );
      }

      list.appendChild(item);
    });
  }

  async function init() {
    await verifyWebsite();

    const params = new URLSearchParams(window.location.search);
    const postId = params.get("post");

    if (postId) {
      await loadArticle(postId);
    } else {
      await loadPosts();
    }
  }

  init().catch(error => {
    console.error("[Carrd CMS]", error);

    if (error.message.includes("not registered")) {
      list.textContent =
        "This website is not registered for this blog.";
    } else {
      list.textContent =
        "Unable to load content. Please try again later.";
    }
  });
})();

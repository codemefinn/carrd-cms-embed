
(function () {
  const script = document.currentScript;
  const blogId = script?.dataset.blogId;

  const FUNCTION_URL = "https://zzgcmdtyfjndfvwfguwh.supabase.co/functions/v1/get-blog-posts";
  const SUPABASE_KEY = "sb_publishable_c6vtRVBqocB6vyOjlyG1tg_3aMfdAYx";

  const gallery = document.getElementById("gallery01");
  const list = gallery?.querySelector("ul");
  const titleElement = document.getElementById("text01");
  const dateElement = document.getElementById("text03");
  const contentElement = document.getElementById("text02");

  if (!blogId || !list || !list.querySelector("li")) {
    console.error(
      "[Carrd CMS] Missing blog ID or Gallery template."
    );
    return;
  }

  const template = list.querySelector("li").cloneNode(true);

  function getPostId() {
    return new URL(window.location.href).searchParams.get("post");
  }

  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC"
    }).format(date);
  }

  async function fetchPosts() {
    const endpoint = new URL(FUNCTION_URL);
    endpoint.searchParams.set("blog_id", blogId);

    const response = await fetch(endpoint.toString(), {
      method: "GET",
      headers: {
        apikey: SUPABASE_KEY
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error || "Failed to load posts."
      );
    }

    return result.posts || [];
  }

  function renderGallery(posts) {
    list.replaceChildren();

    if (!posts.length) {
      const message = document.createElement("li");
      message.textContent = "No published posts yet.";
      list.appendChild(message);
      return;
    }

    posts.forEach(post => {
      const item = template.cloneNode(true);
      const link = item.querySelector("a");
      const image = item.querySelector("img");
      const frame = item.querySelector(".frame");
      const caption = item.querySelector(".caption");

      if (link) {
        const url = new URL(window.location.href);
        url.searchParams.set("post", post.id);
        url.hash = "article";
        link.href = url.toString();
      }

      if (image) {
        if (post.cover_image_url) {
          image.src = post.cover_image_url;
          image.alt = post.title || "";
          image.hidden = false;
          if (frame) frame.hidden = false;
        } else {
          image.removeAttribute("src");
          image.alt = "";
          image.hidden = true;
          if (frame) frame.hidden = true;
        }
      }

      if (caption) {
        const heading = document.createElement("strong");
        heading.textContent = post.title || "Untitled";

        const date = document.createElement("span");
        date.style.color = "#555555";
        date.style.display = "inline-block";
        date.textContent = formatDate(post.published_at);

        const excerpt = document.createElement("span");
        excerpt.textContent = post.excerpt || "";

        caption.replaceChildren(
          heading,
          document.createElement("br"),
          date,
          document.createElement("br"),
          excerpt
        );
      }

      list.appendChild(item);
    });
  }

  function renderArticle(post) {
    if (!post) {
      if (titleElement) titleElement.textContent = "Article not found.";
      if (dateElement) dateElement.textContent = "";
      if (contentElement) contentElement.textContent = "";
      return;
    }

    if (titleElement) {
      titleElement.textContent = post.title || "Untitled";
    }

    if (dateElement) {
      dateElement.textContent = formatDate(post.published_at);
    }

    if (contentElement) {
      contentElement.textContent = post.content || "";
    }
  }

  async function init() {
    const posts = await fetchPosts();
    const postId = getPostId();

    if (postId) {
      const post = posts.find(item => String(item.id) === postId);
      renderArticle(post);
    } else {
      renderGallery(posts);
    }
  }

  init().catch(error => {
    console.error("[Carrd CMS]", error);

    list.replaceChildren();

    const message = document.createElement("li");
    message.textContent =
      "Unable to load posts. Please check your website connection.";

    list.appendChild(message);
  });
})();

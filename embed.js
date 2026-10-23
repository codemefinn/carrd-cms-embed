// Embed.js
// cmsMarkdownToHtml
(function () {
  if (window.cmsMarkdownToHtml) return;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[char];
    });
  }

  function safeUrl(value, imageOnly = false) {
    const raw = value.trim();

    // 允許頁面錨點，例如 #
    if (!imageOnly && raw.startsWith("#")) {
      return raw;
    }

    try {
      const url = new URL(raw);

      if (imageOnly) {
        return ["https:", "http:"].includes(url.protocol)
          ? url.href
          : null;
      }

      return ["https:", "http:", "mailto:", "tel:", "skype:"]
        .includes(url.protocol)
        ? url.href
        : null;
    } catch {
      return null;
    }
  }

  function parseInline(input, depth = 0) {
    if (depth > 10) return escapeHtml(input);

    let result = "";
    let i = 0;

    const rules = [
      {
        re: /^!\[([^\]]*)\]\(([^)\s]+)\)/,
        render: (m) => {
          const url = safeUrl(m[2], true);
          if (!url) return escapeHtml(m[0]);

          return '<img src="' + escapeHtml(url) +
            '" alt="' + escapeHtml(m[1]) +
            '" loading="lazy" style="max-width:100%;height:auto;">';
        }
      },
      {
        re: /^\[([^\]]+)\]\(([^)]+)\)/,
      render: (m, d) => {
        const target = m[2].trim();
        const label = parseInline(m[1], d + 1);

        if (target.startsWith("clipboard:")) {
          const value = target.slice("clipboard:".length);

          return '<a href="#" onclick="_clipboard(event, \'' +
            escapeHtml(value) + '\'); return false;">' +
            label + '</a>';
        }

        if (target.startsWith("copy:")) {
          const value = target.slice("copy:".length);

          return '<a href="#" onclick="_copy(event, \'' +
            escapeHtml(value) + '\'); return false;">' +
            label + '</a>';
        }

        // Carrd 與瀏覽器指令：只允許明確列出的功能
        const actions = {
          "browser:back": "history.back();",
          "browser:forward": "history.forward();",
          "browser:top": "_scrollToTop();",
          "browser:print": "window.print();",
          "section:next": "_nextSection();",
          "section:previous": "_previousSection();",
          "section:first": "_firstSection();",
          "section:last": "_lastSection();",
          "scrollpoint:next": "_nextScrollPoint(event);",
          "scrollpoint:previous": "_previousScrollPoint(event);",
          "scrollpoint:first": "_firstScrollPoint(event);",
          "scrollpoint:last": "_lastScrollPoint(event);"
        };

        if (Object.prototype.hasOwnProperty.call(actions, target)) {
          return '<a href="#" onclick="' + actions[target] +
            'return false;">' + label + '</a>';
        }

        // 複製文字
        if (target.startsWith("copy:") || target.startsWith("clipboard:")) {
          const value = target.slice(target.indexOf(":") + 1);

          if (!value) return label;

          return '<a href="#" data-cms-copy="' +
            escapeHtml(value) + '">' + label + '</a>';
        }

        // 一般網址與頁面錨點
        const safe = safeUrl(target);
        if (!safe) return label;

        if (safe.startsWith("#")) {
          return '<a href="' + safe + '">' + label + '</a>';
        }

        return '<a href="' + safe +
          '" target="_blank" rel="noopener noreferrer">' +
          label + '</a>';
      }
      },
      {
        re: /^\[([\s\S]+?)\]\{(#[0-9a-fA-F]{3,8}|[a-zA-Z]+)\}/,
        render: (m, d) =>
          '<span style="color:' + m[2] + '">' +
          parseInline(m[1], d + 1) + '</span>'
      },
      {
        re: /^`([^`]+)`/,
        render: (m) => '<code>' + escapeHtml(m[1]) + '</code>'
      },
      {
        re: /^\*\*([\s\S]+?)\*\*/,
        render: (m, d) => '<strong>' + parseInline(m[1], d + 1) + '</strong>'
      },
      {
        re: /^__([\s\S]+?)__/,
        render: (m, d) => '<u>' + parseInline(m[1], d + 1) + '</u>'
      },
      {
        re: /^\*([^*]+?)\*/,
        render: (m, d) => '<em>' + parseInline(m[1], d + 1) + '</em>'
      },
      {
        re: /^_([^_]+?)_/,
        render: (m, d) => '<em>' + parseInline(m[1], d + 1) + '</em>'
      },
      {
        re: /^~~([\s\S]+?)~~/,
        render: (m, d) => '<s>' + parseInline(m[1], d + 1) + '</s>'
      },
      {
        re: /^==([\s\S]+?)==/,
        render: (m, d) => '<mark>' + parseInline(m[1], d + 1) + '</mark>'
      },
      {
        re: /^\|\|([\s\S]+?)\|\|/,
        render: (m, d) =>
          '<spoiler-text>' + parseInline(m[1], d + 1) + '</spoiler-text>'
      },
      {
        re: /^~([^~\n]+?)~/,
        render: (m, d) => '<sub>' + parseInline(m[1], d + 1) + '</sub>'
      },
      {
        re: /^\^([^^\n]+?)\^/,
        render: (m, d) => '<sup>' + parseInline(m[1], d + 1) + '</sup>'
      }
    ];

    while (i < input.length) {
      // Carrd 類型的文字跳脫語法
      if (input.startsWith("\\n", i)) {
        result += "<br>";
        i += 2;
        continue;
      }

      if (input.startsWith("\\s", i)) {
        result += "&nbsp;";
        i += 2;
        continue;
      }

      let matched = false;

      for (const rule of rules) {
        const match = input.slice(i).match(rule.re);

        if (match) {
          result += rule.render(match, depth);
          i += match[0].length;
          matched = true;
          break;
        }
      }

      if (matched) continue;

      result += escapeHtml(input[i]);
      i++;
    }

    return result;
  }

  window.cmsMarkdownToHtml = function (markdown) {
    const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");

    return lines.map(function (line) {
      return parseInline(line);
    }).join("<br>\n");
  };
})();



// ============================================================
// Public CMS Embed
// Responsibilities:
// 1. postService: fetch and cache public post data.
// 2. galleryView: render the Carrd Gallery list.
// 3. articleView: render a single article.
// 4. router/init: decide which view to load from the URL.
// Markdown parsing is defined above and kept separate from data fetching.
// ============================================================

(function initCarrdCmsEmbed() {
  // Read the Blog ID from the script tag:
  // <script src=".../embed.js" data-blog-id="YOUR_BLOG_ID"></script>
  const script = document.currentScript;
  const blogId = script?.dataset.blogId;

  // Keep the public endpoints separate: list metadata vs. one full article.
  const FUNCTIONS_BASE_URL =
    "https://zzgcmdtyfjndfvwfguwh.supabase.co/functions/v1";
  const POSTS_LIST_URL = `${FUNCTIONS_BASE_URL}/get-blog-posts`;
  const SINGLE_POST_URL = `${FUNCTIONS_BASE_URL}/get-blog-post`;

  // This is a publishable key, not the service-role secret.
  const SUPABASE_KEY = "sb_publishable_c6vtRVBqocB6vyOjlyG1tg_3aMfdAYx";

  // Carrd element IDs used by the list and article templates.
  const gallery = document.getElementById("gallery01");
  const list = gallery?.querySelector("ul");
  const titleElement = document.getElementById("text01");
  const dateElement = document.getElementById("text03");
  const contentElement = document.getElementById("text02");

  // Keep the original first Gallery item as a template before replacing the list.
  const template = list?.querySelector("li")?.cloneNode(true) ?? null;

  // In-memory caches prevent duplicate requests during this page lifetime.
  let postsPromise = null;
  const postCache = new Map();
  const postRequests = new Map();

  // ------------------------------------------------------------
  // Shared helpers
  // ------------------------------------------------------------

  /** Read the article slug from ?post=slug. */
  function getPostSlug() {
    const match = window.location.hash.match(
      /^#article\?slug=([^&]+)$/
    );

    return match ? decodeURIComponent(match[1]) : null;
  }

  /** Format published dates consistently in English and UTC. */
  function formatDate(value) {
    if (!value) return "";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(date);
  }

  /** Build the canonical Carrd URL for a given article slug. */
  function getArticleUrl(slug) {
    const url = new URL(window.location.href);
    url.hash = `article?slug=${encodeURIComponent(slug)}`;

    console.log("[Carrd CMS] Generated article URL:", url.toString());
    return url.toString();
  }

  /** Safely parse a JSON response and surface API errors. */
  async function readJsonResponse(response, fallbackMessage) {
    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(fallbackMessage);
    }

    if (!response.ok) {
      throw new Error(result?.error || fallbackMessage);
    }

    return result;
  }

  // ------------------------------------------------------------
  // postService
  // Handles Edge Function requests and response caching only.
  // It does not render or manipulate Carrd elements.
  // ------------------------------------------------------------

  /** Fetch all published post summaries (never full article content). */
  function fetchPosts() {
    // Reuse the same promise to avoid duplicate list requests.
    if (postsPromise) return postsPromise;

    const endpoint = new URL(POSTS_LIST_URL);
    endpoint.searchParams.set("blog_id", blogId);

    postsPromise = fetch(endpoint.toString(), {
      method: "GET",
      headers: { apikey: SUPABASE_KEY },
    })
      .then((response) =>
        readJsonResponse(response, "Failed to load posts.")
      )
      .then((result) => {
        if (!Array.isArray(result.posts)) {
          throw new Error("Invalid posts response.");
        }
        return result.posts;
      })
      .catch((error) => {
        // Allow a later retry if this request fails.
        postsPromise = null;
        throw error;
      });

    return postsPromise;
  }

  /** Fetch one published article by slug, caching successful results. */
  function fetchPost(slug) {
    if (!slug) {
      return Promise.reject(new Error("Missing article slug."));
    }

    if (postCache.has(slug)) {
      return Promise.resolve(postCache.get(slug));
    }

    // Reuse an in-flight request if the same slug is requested twice.
    if (postRequests.has(slug)) {
      return postRequests.get(slug);
    }

    const endpoint = new URL(SINGLE_POST_URL);
    endpoint.searchParams.set("blog_id", blogId);
    endpoint.searchParams.set("slug", slug);

    const request = fetch(endpoint.toString(), {
      method: "GET",
      headers: { apikey: SUPABASE_KEY },
    })
      .then((response) =>
        readJsonResponse(response, "Failed to load article.")
      )
      .then((result) => {
        if (!result.post) {
          throw new Error("Invalid article response.");
        }

        postCache.set(slug, result.post);
        return result.post;
      })
      .finally(() => {
        postRequests.delete(slug);
      });

    postRequests.set(slug, request);
    return request;
  }

  // ------------------------------------------------------------
  // galleryView
  // Turns post summaries into Carrd Gallery list items.
  // ------------------------------------------------------------

  /** Render the list of published article summaries. */
  function renderGallery(posts) {
    if (!list || !template) return;

    list.replaceChildren();

    if (!posts.length) {
      const message = document.createElement("li");
      message.textContent = "No published posts yet.";
      list.appendChild(message);
      return;
    }

    posts.forEach((post) => {
      const item = template.cloneNode(true);
      const cardLink = item.querySelector("a");
      const image = item.querySelector("img");
      const frame = item.querySelector(".frame");
      const caption = item.querySelector(".caption");

      // Use slug-based URLs for both card navigation and title navigation.
      const articleUrl = getArticleUrl(post.slug);

      if (cardLink) {
        cardLink.href = articleUrl;
      }

      // Only keep the cover image when a usable HTTP(S) URL is provided.
      // If there is no cover, remove the img and its empty frame entirely.
      const coverUrl = getSafeImageUrl(post.cover_image_url);

      if (coverUrl && image) {
        image.src = coverUrl;
        image.alt = post.title || "";
        image.hidden = false;

        if (frame) frame.hidden = false;
      } else {
        if (image) image.remove();
        if (frame) frame.remove();
      }

      if (caption) {
        const heading = document.createElement("strong");
        heading.textContent = post.title || "Untitled";

        // If the existing card link wraps the caption, the heading is already
        // clickable. Otherwise, create a separate link for the title.
        let titleNode = heading;
        if (!cardLink || !cardLink.contains(caption)) {
          const titleLink = document.createElement("a");
          titleLink.href = articleUrl;
          titleLink.appendChild(heading);
          titleNode = titleLink;
        }

        const date = document.createElement("span");
        date.style.color = "#555555";
        date.style.display = "inline-block";
        date.textContent = formatDate(post.published_at);

        const excerpt = document.createElement("span");
        excerpt.innerHTML = window.cmsMarkdownToHtml(post.excerpt || "");

        // Keep the Carrd caption's existing first paragraph and its styling.
        const captionParagraph = caption.querySelector("p");

        if (captionParagraph) {
          captionParagraph.replaceChildren(
            titleNode,
            document.createElement("br"),
            date,
            document.createElement("br"),
            excerpt
          );
        }
      }

      list.appendChild(item);
    });
  }

  /** Allow only HTTP(S) URLs for cover images. */
  function getSafeImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    try {
      const url = new URL(value.trim());
      return ["https:", "http:"].includes(url.protocol) ? url.href : null;
    } catch {
      return null;
    }
  }

  // ------------------------------------------------------------
  // articleView
  // Fills the Carrd article template with one full published post.
  // ------------------------------------------------------------

  /** Render an article or a clear English error state. */
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
      contentElement.innerHTML = window.cmsMarkdownToHtml(post.content || "");
    }
  }

  function renderArticleError(error) {
    console.error("[Carrd CMS] Unable to load article:", error);

    if (titleElement) {
      titleElement.textContent = "Unable to load article.";
    }
    if (dateElement) dateElement.textContent = "";
    if (contentElement) {
      contentElement.textContent =
        "Please check your website connection and try again.";
    }
  }

  // ------------------------------------------------------------
  // Initialization / routing
  // Load only the data needed for the current URL:
  // - no ?post=... => list summaries
  // - ?post=slug   => one full article
  // ------------------------------------------------------------

  async function init() {
    if (!blogId) {
      console.error("[Carrd CMS] Missing data-blog-id on the embed script.");
      return;
    }

    const slug = getPostSlug();

    if (slug) {
      try {
        const post = await fetchPost(slug);
        renderArticle(post);
      } catch (error) {
        renderArticleError(error);
      }
      return;
    }

    if (!list || !template) {
      console.error(
        "[Carrd CMS] Missing Gallery template. Add a Gallery with ID gallery01 and at least one list item."
      );
      return;
    }

    try {
      const posts = await fetchPosts();
      renderGallery(posts);
    } catch (error) {
      console.error("[Carrd CMS] Unable to load posts:", error);

      list.replaceChildren();

      const message = document.createElement("li");
      message.textContent =
        "Unable to load posts. Please check your website connection.";

      list.appendChild(message);
    }
  }

  init();
})();

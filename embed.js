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
  const gallery = document.getElementById(
    config.selectors.gallery
  );

  const list = gallery?.querySelector("ul");

  const titleElement = document.getElementById(
    config.selectors.title
  );

  const dateElement = document.getElementById(
    config.selectors.date
  );

  const contentElement = document.getElementById(
    config.selectors.content
  );

  const pagination = document.getElementById(
    config.selectors.pagination
  );

  let currentPage = 1;
  let allPosts = [];

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
    const url = new URL(window.location.href);
    return url.searchParams.get("slug");
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

    // Remove only the CMS article parameters.
    url.searchParams.delete("slug");
    url.searchParams.delete("post");

    // Add the selected article slug.
    url.searchParams.set("slug", slug);

    // Keep Carrd's native section navigation.
    url.hash = "article";

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
  function initPagination() {
    if (!pagination) {
      console.warn(
        "[Carrd CMS] Pagination element not found:",
        config.selectors.pagination
      );
      return;
    }

    pagination.addEventListener("click", (event) => {
      const link = event.target.closest("a.n01, a.n02");
      const pageButton = event.target.closest("button[data-page]");

      if (!link && !pageButton) return;

      event.preventDefault();

      const totalPages = Math.ceil(
        allPosts.length / config.postsPerPage
      );

      if (pageButton) {
        currentPage = Number(pageButton.dataset.page);
      } else if (link.matches(".n01")) {
        currentPage--;
      } else if (link.matches(".n02")) {
        currentPage++;
      }

      currentPage = Math.max(
        1,
        Math.min(currentPage, totalPages)
      );

      renderGallery(allPosts);
    });
  }

  function renderPagination(totalPages) {
    if (!pagination) return;

    const prevLink = pagination.querySelector("a.n01");
    const nextLink = pagination.querySelector("a.n02");

    // Remove previously generated page numbers.
    pagination
      .querySelectorAll("[data-cms-page]")
      .forEach((item) => item.remove());

    const prevItem = prevLink?.closest("li");
    const nextItem = nextLink?.closest("li");

    if (!prevItem || !nextItem) {
      console.error(
        "[Carrd CMS] Pagination requires .n01 and .n02 links."
      );
      return;
    }

    const pageCount = Math.max(0, totalPages);

    // Insert page numbers between the existing arrows.
    for (let page = 1; page <= pageCount; page++) {
      const item = document.createElement("li");
      item.dataset.cmsPage = String(page);

      item.style.display = "flex";
      item.style.alignItems = "center";
      item.style.justifyContent = "center";

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = String(page);
      button.dataset.page = String(page);
      button.setAttribute("aria-label", `Page ${page}`);

      const caption = gallery.querySelector('.caption > p');

      // Inherit Carrd's existing typography.
      const captionStyle = caption
        ? window.getComputedStyle(caption)
        : null;

      button.style.fontFamily = captionStyle
        ? captionStyle.fontFamily
        : "inherit";

      button.style.fontSize = captionStyle
        ? captionStyle.fontSize
        : "inherit";

      button.style.fontWeight = "inherit";

      // const paginationColor = caption
      //   ? window.getComputedStyle(caption).color
      //   : window.getComputedStyle(caption).color;

         button.style.color = captionStyle
        ? captionStyle.color
        : "inherit";

      // button.style.setProperty("color", paginationColor, "important");

      button.style.lineHeight = captionStyle
        ? captionStyle.lineHeight
        : "normal";

      button.style.background = "transparent";
      button.style.border = "0";
      button.style.padding = "0 0.35em";
      button.style.margin = "0";
      button.style.cursor = "pointer";

      // Center the page number vertically.
      button.style.display = "inline-flex";
      button.style.alignItems = "center";
      button.style.justifyContent = "center";
      button.style.verticalAlign = "middle";

      if (page === currentPage) {
        button.style.fontWeight = "700";
        button.setAttribute("aria-current", "page");
        button.disabled = true;
        button.style.cursor = "default";
      }

      item.appendChild(button);
      pagination.insertBefore(item, nextItem);
    }

    // Disable arrows when there is no previous or next page.
    const disableArrow = (link, disabled) => {
      if (!link) return;

      link.setAttribute("aria-disabled", String(disabled));
      link.style.opacity = disabled ? "0.35" : "";
      link.style.pointerEvents = disabled ? "none" : "";
    };

    disableArrow(prevLink, currentPage <= 1 || pageCount === 0);
    disableArrow(nextLink, currentPage >= pageCount || pageCount === 0);

    pagination.hidden = pageCount <= 1;
  }

  /** Render the list of published article summaries. */
  function renderGallery(posts) {
    if (!list || !template) return;

    allPosts = posts;

    const totalPages = Math.ceil(
      allPosts.length / config.postsPerPage
    );

    // Keep the current page valid if the number of posts changes.
    currentPage = Math.max(
      1,
      Math.min(currentPage, Math.max(totalPages, 1))
    );

    const startIndex =
      (currentPage - 1) * config.postsPerPage;

    const visiblePosts = allPosts.slice(
      startIndex,
      startIndex + config.postsPerPage
    );

    list.replaceChildren();

    if (!allPosts.length) {
      const message = document.createElement("li");
      message.textContent = "No published posts yet.";
      list.appendChild(message);

      renderPagination(0);
      return;
    }

    visiblePosts.forEach((post) => {
      const item = template.cloneNode(true);
      const cardLink = item.querySelector("a");
      const image = item.querySelector("img");
      const frame = item.querySelector(".frame");
      const caption = item.querySelector(".caption");

      const articleUrl = getArticleUrl(post.slug);

      if (cardLink) {
        cardLink.href = articleUrl;
      }

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
        excerpt.innerHTML = window.cmsMarkdownToHtml(
          post.excerpt || ""
        );

        // Preserve the original Carrd caption paragraph.
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

    renderPagination(totalPages);
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

  function initSectionNavigation() {
    document.addEventListener("click", event => {
      const link = event.target.closest("a[href]");
      if (!link) return;

      const rawHref = link.getAttribute("href");
      if (!rawHref || !rawHref.startsWith("#")) return;

      // Keep the article URL unchanged when clicking #article.
      const {
        articlesSection,
        articleSection
      } = config.selectors;

      if (rawHref === `#${articleSection}`) return;

      const url = new URL(window.location.href);

      // Remove CMS article parameters only.
      url.searchParams.delete("slug");
      url.searchParams.delete("post");

      history.replaceState(history.state, "", url);

      // Restore the post list when navigating to #articles.
      if (rawHref === `#${articlesSection}`) {
        loadCurrentGallery();
      }
    }, true);
  }

  async function loadCurrentGallery() {
    if (!list || !template) return;

    try {
      const posts = await fetchPosts();

      currentPage = 1;
      renderGallery(posts);
    } catch (error) {
      console.error("[Carrd CMS] Unable to load posts:", error);
    }
  }

  function initArticleNavigation() {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;

      const url = new URL(link.href, window.location.href);

      if (
        url.origin !== window.location.origin ||
        !url.searchParams.has("slug") ||
        url.hash !== "#article"
      ) {
        return;
      }

      event.preventDefault();

      const slug = url.searchParams.get("slug");

      // Update the URL without reloading the page.
      history.pushState(history.state, "", url);

      // Trigger Carrd's native section navigation.
      window.dispatchEvent(new HashChangeEvent("hashchange"));

      // Load and render the selected article.
      loadCurrentArticle(slug);
    });

    window.addEventListener("popstate", () => {
      // Synchronize Carrd's section with the current URL.
      window.dispatchEvent(new HashChangeEvent("hashchange"));

      const slug = getPostSlug();

      // Restore the article when navigating back or forward
      // to an article URL.
      if (slug && window.location.hash === "#article") {
        loadCurrentArticle(slug);
      }
    });
  }

  let articleRequestId = 0;

  async function loadCurrentArticle(slug) {
    const requestId = ++articleRequestId;

    // Clear the previous article immediately.
    if (titleElement) titleElement.textContent = "Loading article...";
    if (dateElement) dateElement.textContent = "";
    if (contentElement) contentElement.replaceChildren();

    try {
      const post = await fetchPost(slug);

      // Ignore stale responses from earlier clicks.
      if (requestId !== articleRequestId) return;

      renderArticle(post);
    } catch (error) {
      if (requestId !== articleRequestId) return;

      renderArticleError(error);
    }
  }

  // ------------------------------------------------------------
  // Initialization / routing
  // Load only the data needed for the current URL:
  // - no ?post=... => list summaries
  // - ?post=slug   => one full article
  // ------------------------------------------------------------


  async function init() {
    initSectionNavigation();
    initArticleNavigation();

    if (!blogId) {
      console.error("[Carrd CMS] Missing data-blog-id on the embed script.");
      return;
    }

    initPagination();

    const slug = getPostSlug();

    // Load the requested article when the URL contains a slug.
    if (slug && window.location.hash === "#article") {
      try {
        console.log("[Carrd CMS] Initial slug:", slug);

        const post = await fetchPost(slug);

        console.log("[Carrd CMS] Article fetched:", post);

        renderArticle(post);
      } catch (error) {
        console.error("[Carrd CMS] Initial article load failed:", error);
        renderArticleError(error);
      }
      return;
    }

    // Only require the Gallery when displaying the post list.
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

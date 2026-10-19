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



// supabase
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
        excerpt.innerHTML = cmsMarkdownToHtml(post.excerpt || "");

        caption.firstElementChild.replaceChildren(
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
      contentElement.innerHTML = cmsMarkdownToHtml(post.content || "");
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

// Velo-Savvy: small progressive enhancements. Every page works without this file.
(function () {
  "use strict";

  // Mobile navigation
  var toggle = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("site-nav");
  if (toggle && nav) {
    var setOpen = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      nav.classList.toggle("is-open", open);
      document.body.classList.toggle("nav-open", open);
    };
    toggle.addEventListener("click", function () {
      setOpen(toggle.getAttribute("aria-expanded") !== "true");
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && nav.classList.contains("is-open")) { setOpen(false); toggle.focus(); }
    });
    nav.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false); });
  }

  // Header gets a solid background once the page scrolls
  var header = document.querySelector("[data-header]");
  if (header) {
    var onScroll = function () { header.classList.toggle("is-scrolled", window.scrollY > 24); };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Journal topic filters
  var filters = document.querySelector("[data-filters]");
  if (filters) {
    filters.hidden = false;
    var items = document.querySelectorAll(".post-card[data-category], .feature[data-category]");
    filters.addEventListener("click", function (e) {
      var btn = e.target.closest("[data-filter]");
      if (!btn) return;
      var value = btn.getAttribute("data-filter");
      filters.querySelectorAll("[data-filter]").forEach(function (b) {
        b.setAttribute("aria-pressed", String(b === btn));
      });
      items.forEach(function (el) {
        el.hidden = value !== "all" && el.getAttribute("data-category") !== value;
      });
    });
  }

  // Contact form: preselect the plan passed as ?plan=Name
  var planSelect = document.querySelector("[data-plan-select]");
  if (planSelect) {
    var plan = new URLSearchParams(window.location.search).get("plan");
    if (plan) {
      Array.prototype.forEach.call(planSelect.options, function (o) {
        if (o.value === plan) planSelect.value = plan;
      });
    }
  }

  // Programs page: "Tell me when it's on" preselects that program in the form
  var programSelect = document.querySelector("[data-program-select]");
  if (programSelect) {
    document.addEventListener("click", function (e) {
      var link = e.target.closest("[data-program]");
      if (link) programSelect.value = link.getAttribute("data-program");
    });
  }

  // Thanks page: different message after a newsletter signup
  var thanks = document.querySelector("[data-thanks-text]");
  if (thanks && new URLSearchParams(window.location.search).get("form") === "newsletter") {
    thanks.textContent = "You're on the list. The next ride notes will land in your inbox on Friday.";
  }
})();

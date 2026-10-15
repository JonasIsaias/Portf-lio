"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

  // Ano automático no rodapé.
  $$(".current-year").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });

  // Menu responsivo.
  const menuToggle = $("#menuToggle");
  const siteNav = $("#siteNav");

  function closeMenu() {
    if (!menuToggle || !siteNav) return;

    siteNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", "Abrir menu");

    const icon = $("i", menuToggle);
    if (icon) icon.className = "fa-solid fa-bars";
  }

  if (menuToggle && siteNav) {
    menuToggle.addEventListener("click", () => {
      const isOpen = siteNav.classList.toggle("is-open");

      menuToggle.setAttribute("aria-expanded", String(isOpen));
      menuToggle.setAttribute(
        "aria-label",
        isOpen ? "Fechar menu" : "Abrir menu"
      );

      const icon = $("i", menuToggle);
      if (icon) {
        icon.className = isOpen
          ? "fa-solid fa-xmark"
          : "fa-solid fa-bars";
      }
    });

    $$(".site-nav a", siteNav).forEach((link) => {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });

    document.addEventListener("click", (event) => {
      if (
        siteNav.classList.contains("is-open") &&
        !siteNav.contains(event.target) &&
        !menuToggle.contains(event.target)
      ) {
        closeMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 760) closeMenu();
    });
  }

  // Digitação automática na página inicial.
  const typingElement = $("#texto-animado");

  if (typingElement) {
    const phrases = [
      "Desenvolvedor de software.",
      "Criando soluções com Python e Java.",
      "Automatizando processos com código.",
      "Transformando ideias em tecnologia."
    ];

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      typingElement.textContent = phrases[0];
    } else {
      let phraseIndex = 0;
      let characterIndex = 0;
      let deleting = false;
      let timer = null;

      function typePhrase() {
        if (!typingElement.isConnected) return;

        const phrase = phrases[phraseIndex];

        if (!deleting) {
          characterIndex++;
          typingElement.textContent = phrase.slice(0, characterIndex);

          if (characterIndex >= phrase.length) {
            deleting = true;
            timer = window.setTimeout(typePhrase, 1800);
            return;
          }
        } else {
          characterIndex--;
          typingElement.textContent = phrase.slice(0, characterIndex);

          if (characterIndex <= 0) {
            deleting = false;
            phraseIndex = (phraseIndex + 1) % phrases.length;
            timer = window.setTimeout(typePhrase, 350);
            return;
          }
        }

        timer = window.setTimeout(typePhrase, deleting ? 28 : 65);
      }

      timer = window.setTimeout(typePhrase, 500);

      document.addEventListener("visibilitychange", () => {
        if (document.hidden && timer !== null) {
          clearTimeout(timer);
          timer = null;
        } else if (!document.hidden && timer === null) {
          timer = window.setTimeout(typePhrase, 400);
        }
      });
    }
  }

  // Filtros da página de projetos.
  const missionGrid = $("#missionGrid");
  const filterButtons = $$(".filter-btn");

  if (missionGrid && filterButtons.length) {
    const cards = $$(".mission-card", missionGrid);
    const resultsLabel = $("#resultsLabel");
    const projectCount = $("#projectCount");
    const emptyState = $("#emptyState");

    function applyFilter(filter) {
      let visibleCount = 0;

      cards.forEach((card) => {
        const categories = (card.dataset.category || "")
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);

        const visible =
          filter === "all" || categories.includes(filter);

        card.classList.toggle("is-hidden", !visible);
        card.setAttribute("aria-hidden", String(!visible));

        if (visible) visibleCount++;
      });

      filterButtons.forEach((button) => {
        const active = button.dataset.filter === filter;

        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      });

      if (resultsLabel) {
        resultsLabel.textContent = `${String(visibleCount).padStart(2, "0")} RESULTADOS`;
      }

      if (projectCount) {
        projectCount.textContent = `${String(visibleCount).padStart(2, "0")} MISSÕES`;
      }

      if (emptyState) {
        emptyState.hidden = visibleCount !== 0;
      }
    }

    filterButtons.forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.classList.contains("active"))
      );

      button.addEventListener("click", () => {
        applyFilter(button.dataset.filter || "all");
      });
    });

    applyFilter("all");
  }

  // Contador de caracteres no formulário.
  const messageField = $("#message");
  const characterCount = $("#characterCount");

  if (messageField && characterCount) {
    const updateCharacterCount = () => {
      characterCount.textContent = String(messageField.value.length);
    };

    messageField.addEventListener("input", updateCharacterCount);
    updateCharacterCount();
  }

  
  // Formulário: prepara uma mensagem para o aplicativo de e-mail.
  const contactForm = $("#contactForm");
  const formFeedback = $("#formFeedback");

  if (contactForm) {
    contactForm.addEventListener("submit", (event) => {
      event.preventDefault();

      if (!contactForm.reportValidity()) return;

      const formData = new FormData(contactForm);

      const name = String(formData.get("name") || "").trim();
      const email = String(formData.get("email") || "").trim();
      const subject = String(formData.get("subject") || "").trim();
      const message = String(formData.get("message") || "").trim();

      if (!name || !email || !subject || !message) {
        if (formFeedback) {
          formFeedback.textContent =
            "Preencha todos os campos obrigatórios.";
        }
        return;
      }

      // E-mail que receberá a mensagem.
      const recipient = "jonas.isaiasdev@gmail.com";

      const emailSubject = `[Portfólio] ${subject}`;

      const body = [
        `Nome: ${name}`,
        `E-mail para resposta: ${email}`,
        "",
        "Mensagem:",
        message,
        "",
        "---",
        "Enviado pelo portfólio de Jonas Isaias."
      ].join("\n");

      const mailto =
        `mailto:${recipient}` +
        `?subject=${encodeURIComponent(emailSubject)}` +
        `&body=${encodeURIComponent(body)}`;

      if (formFeedback) {
        formFeedback.textContent =
          "Abrindo seu aplicativo de e-mail. Revise a mensagem e clique em Enviar.";
      }

      window.location.href = mailto;
    });
  }

  // Botões de retorno ao topo.
  $$(".back-to-top").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      window.scrollTo({
        top: 0,
        behavior: window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches ? "auto" : "smooth"
      });
    });
  });

  // Entrada suave dos elementos ao rolar a página.
  const revealSelectors = [
    ".project-card",
    ".content-panel",
    ".mission-card",
    ".mission-counter",
    ".intro-item",
    ".terminal-window",
    ".contact-method"
  ];

  const revealElements = $$(revealSelectors.join(","));

  const canAnimate = !window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (canAnimate && "IntersectionObserver" in window) {
    revealElements.forEach((element) => element.classList.add("reveal"));
    document.body.classList.add("reveal-ready");

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 }
    );

    revealElements.forEach((element) => observer.observe(element));
  }

  // Efeito de movimento sutil no desktop.
  const heroVisual = $(".hero-visual");
  const hasFinePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  if (heroVisual && hasFinePointer && canAnimate) {
    heroVisual.addEventListener("mousemove", (event) => {
      const rect = heroVisual.getBoundingClientRect();

      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;

      heroVisual.style.setProperty("--pointer-x", `${x * 8}px`);
      heroVisual.style.setProperty("--pointer-y", `${y * 8}px`);
    });

    heroVisual.addEventListener("mouseleave", () => {
      heroVisual.style.setProperty("--pointer-x", "0px");
      heroVisual.style.setProperty("--pointer-y", "0px");
    });
  }

  // A tela de inicialização existe apenas na página inicial.
  const bootScreen = $("#bootScreen");

  if (bootScreen) {
    const bootStatus = $("#bootStatus");
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (reducedMotion) {
      bootScreen.remove();
    } else {
      if (bootStatus) bootStatus.textContent = "LOADING MODULES...";

      window.setTimeout(() => {
        if (bootStatus) bootStatus.textContent = "SYSTEM READY";
      }, 650);

      window.setTimeout(() => {
        bootScreen.classList.add("is-done");

        window.setTimeout(() => {
          bootScreen.remove();
        }, 600);
      }, 1450);
    }
  }
});

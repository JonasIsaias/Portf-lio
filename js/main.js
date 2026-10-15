"use strict";

(() => {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  const finePointer = window.matchMedia(
    "(hover: hover) and (pointer: fine)"
  ).matches;

  const starsCanvas = document.getElementById("stars");
  const particleCanvas = document.getElementById("canvas");

  const random = (min, max) => Math.random() * (max - min) + min;

  function createCanvasRenderer(canvas, mode) {
    if (!canvas) return null;

    const context = canvas.getContext("2d", { alpha: true });
    if (!context) return null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let particles = [];
    let animationId = null;
    let isVisible = true;
    let lastFrame = 0;

    const particleCount = () => {
      const area = window.innerWidth * window.innerHeight;
      const divisor = mode === "stars" ? 10500 : 24000;
      const min = mode === "stars" ? 35 : 14;
      const max = mode === "stars" ? 115 : 48;

      return Math.max(min, Math.min(max, Math.round(area / divisor)));
    };

    function createParticle() {
      if (mode === "stars") {
        return {
          x: random(0, width),
          y: random(0, height),
          radius: random(0.35, 1.45),
          alpha: random(0.2, 0.85),
          phase: random(0, Math.PI * 2),
          speed: random(0.25, 1.1),
          drift: random(-0.08, 0.08)
        };
      }

      return {
        x: random(0, width),
        y: random(0, height),
        radius: random(0.7, 1.8),
        alpha: random(0.2, 0.65),
        vx: random(-0.13, 0.13),
        vy: random(-0.12, 0.12)
      };
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = particleCount();

      if (particles.length > count) {
        particles.length = count;
      }

      while (particles.length < count) {
        particles.push(createParticle());
      }

      drawStatic();
    }

    function drawStatic() {
      context.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (mode === "stars") {
          context.fillStyle = `rgba(190, 220, 255, ${particle.alpha})`;
        } else {
          context.fillStyle = `rgba(0, 245, 212, ${particle.alpha * 0.6})`;
        }

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );
        context.fill();
      });
    }

    function drawConnections() {
      if (mode !== "particles") return;

      const maxDistance = Math.min(145, width * 0.19);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];

          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const alpha = (1 - distance / maxDistance) * 0.11;

            context.strokeStyle = `rgba(0, 245, 212, ${alpha})`;
            context.lineWidth = 0.7;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
      }
    }

    function animate(timestamp) {
      if (!isVisible || document.hidden) {
        animationId = null;
        return;
      }

      if (timestamp - lastFrame < 32) {
        animationId = requestAnimationFrame(animate);
        return;
      }

      lastFrame = timestamp;
      context.clearRect(0, 0, width, height);

      particles.forEach((particle) => {
        if (mode === "stars") {
          particle.phase += 0.012 * particle.speed;
          particle.y += 0.04 * particle.speed;
          particle.x += particle.drift;

          if (particle.y > height + 3) {
            particle.y = -3;
            particle.x = random(0, width);
          }

          if (particle.x < -3) particle.x = width + 3;
          if (particle.x > width + 3) particle.x = -3;

          const twinkle = 0.65 + Math.sin(particle.phase) * 0.35;

          context.fillStyle =
            `rgba(190, 220, 255, ${particle.alpha * twinkle})`;
        } else {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;

          context.fillStyle =
            `rgba(0, 245, 212, ${particle.alpha * 0.7})`;
        }

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );
        context.fill();
      });

      drawConnections();
      animationId = requestAnimationFrame(animate);
    }

    function start() {
      if (animationId !== null || !isVisible || document.hidden) return;

      if (reducedMotion) {
        drawStatic();
        return;
      }

      animationId = requestAnimationFrame(animate);
    }

    function stop() {
      if (animationId !== null) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    }

    function setVisible(visible) {
      isVisible = visible;

      if (visible) {
        start();
      } else {
        stop();
      }
    }

    resize();

    if (!reducedMotion) {
      start();
    }

    return {
      resize,
      start,
      stop,
      setVisible
    };
  }

  const starsRenderer = createCanvasRenderer(starsCanvas, "stars");
  const particlesRenderer = createCanvasRenderer(particleCanvas, "particles");

  let resizeTimer = null;

  window.addEventListener("resize", () => {
    if (resizeTimer !== null) {
      clearTimeout(resizeTimer);
    }

    resizeTimer = window.setTimeout(() => {
      starsRenderer?.resize();
      particlesRenderer?.resize();
      resizeTimer = null;
    }, 120);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      starsRenderer?.stop();
      particlesRenderer?.stop();
    } else {
      starsRenderer?.start();
      particlesRenderer?.start();
    }
  });

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.target === document.documentElement) {
          const visible = entry.isIntersecting;

          starsRenderer?.setVisible(visible);
          particlesRenderer?.setVisible(visible);
        }
      });
    });

    observer.observe(document.documentElement);
  }

  if (finePointer && !reducedMotion && particlesRenderer) {
    let pointerX = -1000;
    let pointerY = -1000;

    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
    }, { passive: true });

    // O movimento do ponteiro é usado somente para uma interação discreta.
    // Não há processamento contínuo adicional para economizar recursos.
    document.addEventListener("pointerleave", () => {
      pointerX = -1000;
      pointerY = -1000;
    });

    void pointerX;
    void pointerY;
  }
})();

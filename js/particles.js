window.addEventListener("load", () => {
  const canvas = document.getElementById("canvas");
  const ctx = canvas.getContext("2d");

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener("resize", resize);

  class Particle {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = (Math.random() - 0.5) * 2;
      this.vy = (Math.random() - 0.5) * 2;
      this.radius = 3;
    }

    update(mouse) {
      this.vx += (Math.random() - 0.5) * 1.2;
      this.vy += (Math.random() - 0.5) * 1.2;

      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        const angle = Math.atan2(dy, dx);
        const force = (150 - dist) / 150;
        this.vx += Math.cos(angle) * force * 2;
        this.vy += Math.sin(angle) * force * 2;
      }

      this.vx *= 0.92;
      this.vy *= 0.92;

      this.x += this.vx;
      this.y += this.vy;

      if (this.x <= 0 || this.x >= canvas.width) this.vx *= -1;
      if (this.y <= 0 || this.y >= canvas.height) this.vy *= -1;
    }

    draw() {
      ctx.beginPath();
      ctx.fillStyle = "#ff5500";
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  class Network {
    constructor() {
      this.particles = [];
      this.maxDistance = 180;
      const total = window.innerWidth < 768 ? 20 : 40;

      for (let i = 0; i < total; i++) {
        this.addParticle(Math.random() * canvas.width, Math.random() * canvas.height);
      }
    }

    addParticle(x, y) {
      this.particles.push(new Particle(x, y));
    }

    drawLines() {
      for (let i = 0; i < this.particles.length; i++) {
        for (let j = i + 1; j < this.particles.length; j++) {
          const p1 = this.particles[i];
          const p2 = this.particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.maxDistance) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(255, 85, 0, ${1 - dist / this.maxDistance})`;
            ctx.lineWidth = 1;
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
    }

    update(mouse) {
      this.particles.forEach(p => p.update(mouse));
    }

    draw() {
      this.particles.forEach(p => p.draw());
      this.drawLines();
    }
  }

  const network = new Network();
  const mouse = { x: -9999, y: -9999 };

  window.addEventListener("click", (e) => {
    network.addParticle(e.clientX, e.clientY);
  });
  window.addEventListener("mousemove", (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    network.update(mouse);
    network.draw();
    requestAnimationFrame(animate);
  }

  // Estrelas
  const starCanvas = document.getElementById("stars");
  const starCtx = starCanvas.getContext("2d");

  function resizeStars() {
    starCanvas.width = window.innerWidth;
    starCanvas.height = window.innerHeight;
  }
  resizeStars();
  window.addEventListener("resize", resizeStars);

  const stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: Math.random() * starCanvas.width,
      y: Math.random() * starCanvas.height,
      radius: Math.random() * 1.5,
      alpha: Math.random(),
      delta: Math.random() * 0.02
    });
  }

  function drawStars() {
    starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
    for (let star of stars) {
      star.alpha += star.delta;
      if (star.alpha <= 0 || star.alpha >= 1) star.delta *= -1;

      starCtx.beginPath();
      starCtx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
      starCtx.fillStyle = `rgba(255,255,255,${star.alpha})`;
      starCtx.fill();
    }
    requestAnimationFrame(drawStars);
  }

  animate();
  drawStars();

  starCanvas.style.position = "fixed";
  starCanvas.style.top = "0";
  starCanvas.style.left = "0";
  starCanvas.style.zIndex = "0";
});
// particles.js - Comprehensive Flowing Starlight & Running Meteor Engine for Noor

class NoorParticles {
  constructor() {
    this.canvas = document.getElementById('particles-canvas');
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    // Particle buckets
    this.stars = [];
    this.sparkles = [];
    this.shootingStars = [];
    this.celebrationParticles = [];

    // Color palettes (Celestial Azure, Starlight Gold, Pure Radiant White)
    this.colors = ['#38bdf8', '#fbbf24', '#ffffff', '#60a5fa', '#f59e0b', '#e0f2fe'];

    this.raf = null;
    this.lastShootingStarTime = Date.now();
    this.shootingStarInterval = 2800; // spawn every ~2.8s

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Interactive sparkle trails on touch/pointer move
    this.bindInteractivity();

    // Spawn stars and start 60fps flowing loop
    this.initFlowingStars();
    this.animate();
  }

  resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  initFlowingStars() {
    this.stars = [];
    this.sparkles = [];

    const area = this.canvas.width * this.canvas.height;
    // Density calculation
    const starCount = Math.min(90, Math.max(45, Math.floor(area / 16000)));
    const sparkleCount = Math.min(30, Math.max(16, Math.floor(area / 40000)));

    // 1. Flowing, drifting stardust particles
    for (let i = 0; i < starCount; i++) {
      this.stars.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        r: Math.random() * 1.8 + 0.6,
        alpha: Math.random() * 0.7 + 0.2,
        baseAlpha: Math.random() * 0.6 + 0.3,
        twinkleSpeed: (Math.random() * 0.02 + 0.008) * (Math.random() < 0.5 ? 1 : -1),
        // Flowing upwards and slightly drifting sideways
        vx: (Math.random() - 0.5) * 0.35,
        vy: -Math.random() * 0.65 - 0.25,
        sineOffset: Math.random() * Math.PI * 2,
        sineSpeed: Math.random() * 0.02 + 0.01,
        color: this.colors[Math.floor(Math.random() * this.colors.length)]
      });
    }

    // 2. 4-point rotating sparkle stars
    for (let i = 0; i < sparkleCount; i++) {
      this.sparkles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 4.5 + 2.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() * 0.02 + 0.005) * (Math.random() < 0.5 ? 1 : -1),
        alpha: Math.random() * 0.65 + 0.25,
        twinkleSpeed: Math.random() * 0.02 + 0.01,
        vy: -Math.random() * 0.45 - 0.15,
        vx: (Math.random() - 0.5) * 0.2,
        color: Math.random() > 0.4 ? '#fbbf24' : '#38bdf8'
      });
    }
  }

  // Shooting stars (Running stars sweeping across the night sky)
  spawnShootingStar() {
    // Pick random start along the top or right border
    const fromTop = Math.random() < 0.7;
    const startX = fromTop ? Math.random() * this.canvas.width * 0.9 + this.canvas.width * 0.1 : this.canvas.width + 20;
    const startY = fromTop ? -20 : Math.random() * this.canvas.height * 0.4;

    const angle = (Math.PI / 4) + (Math.random() * 0.25 - 0.12); // ~45 degrees diagonal
    const speed = Math.random() * 7 + 8;

    this.shootingStars.push({
      x: startX,
      y: startY,
      vx: -Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      length: Math.random() * 60 + 55,
      size: Math.random() * 1.5 + 1.2,
      alpha: 1.0,
      decay: Math.random() * 0.018 + 0.012,
      color: Math.random() > 0.5 ? '#38bdf8' : '#fbbf24'
    });
  }

  bindInteractivity() {
    let lastMove = 0;
    const addSparkle = (clientX, clientY) => {
      const now = Date.now();
      if (now - lastMove < 50) return; // throttle to 20fps
      lastMove = now;

      for (let i = 0; i < 2; i++) {
        this.stars.push({
          x: clientX + (Math.random() - 0.5) * 20,
          y: clientY + (Math.random() - 0.5) * 20,
          r: Math.random() * 2 + 1,
          alpha: 0.9,
          baseAlpha: 0.8,
          twinkleSpeed: -0.04, // fade out quickly
          vx: (Math.random() - 0.5) * 1.2,
          vy: -Math.random() * 1.2 - 0.3,
          sineOffset: 0,
          sineSpeed: 0,
          isEphemeral: true,
          color: this.colors[Math.floor(Math.random() * this.colors.length)]
        });
      }
    };

    window.addEventListener('pointermove', (e) => addSparkle(e.clientX, e.clientY), { passive: true });
    window.addEventListener('touchmove', (e) => {
      if (e.touches && e.touches[0]) {
        addSparkle(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  triggerCelebration() {
    for (let i = 0; i < 160; i++) {
      this.celebrationParticles.push({
        x: this.canvas.width / 2,
        y: this.canvas.height / 2,
        vx: (Math.random() - 0.5) * 24,
        vy: (Math.random() - 0.5) * 24 - 6,
        life: 1.0,
        decay: Math.random() * 0.02 + 0.015,
        color: this.colors[Math.floor(Math.random() * this.colors.length)],
        size: Math.random() * 4 + 2
      });
    }
  }

  startRamadanBackground() {
    this.initFlowingStars();
  }

  // Draw 4-point sparkling celestial diamond star
  drawSparkleStar(cx, cy, size, angle, color, alpha) {
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate(angle);
    this.ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    this.ctx.fillStyle = color;
    this.ctx.shadowColor = color;
    this.ctx.shadowBlur = size * 2.5;

    this.ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const rot = (i * Math.PI) / 2;
      const nextRot = ((i + 1) * Math.PI) / 2;
      if (i === 0) {
        this.ctx.moveTo(Math.cos(rot) * size, Math.sin(rot) * size);
      } else {
        this.ctx.lineTo(Math.cos(rot) * size, Math.sin(rot) * size);
      }
      this.ctx.quadraticCurveTo(0, 0, Math.cos(nextRot) * size, Math.sin(nextRot) * size);
    }
    this.ctx.closePath();
    this.ctx.fill();

    // Central bright glow pin
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(0, 0, size * 0.25, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  // Draw shooting star / meteor trail
  drawShootingStar(star) {
    this.ctx.save();
    this.ctx.globalAlpha = Math.max(0, Math.min(1, star.alpha));

    const trailEndX = star.x - (star.vx / 10) * star.length;
    const trailEndY = star.y - (star.vy / 10) * star.length;

    const grad = this.ctx.createLinearGradient(star.x, star.y, trailEndX, trailEndY);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, star.color);
    grad.addColorStop(1, 'transparent');

    this.ctx.strokeStyle = grad;
    this.ctx.lineWidth = star.size;
    this.ctx.lineCap = 'round';
    this.ctx.shadowColor = star.color;
    this.ctx.shadowBlur = 10;

    this.ctx.beginPath();
    this.ctx.moveTo(star.x, star.y);
    this.ctx.lineTo(trailEndX, trailEndY);
    this.ctx.stroke();

    // Glowing comet head
    this.ctx.fillStyle = '#ffffff';
    this.ctx.beginPath();
    this.ctx.arc(star.x, star.y, star.size * 1.3, 0, Math.PI * 2);
    this.ctx.fill();

    this.ctx.restore();
  }

  animate() {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const now = Date.now();
    // Periodically spawn shooting star
    if (now - this.lastShootingStarTime > this.shootingStarInterval) {
      this.spawnShootingStar();
      this.lastShootingStarTime = now + (Math.random() * 1500 - 500);
    }

    // 1. UPDATE & RENDER FLOWING STARS
    for (let i = this.stars.length - 1; i >= 0; i--) {
      const star = this.stars[i];

      star.alpha += star.twinkleSpeed;
      if (star.isEphemeral) {
        if (star.alpha <= 0) {
          this.stars.splice(i, 1);
          continue;
        }
      } else {
        if (star.alpha > star.baseAlpha + 0.35 || star.alpha < star.baseAlpha - 0.25) {
          star.twinkleSpeed = -star.twinkleSpeed;
        }
      }

      // Sine wave gentle horizontal wave
      star.sineOffset += star.sineSpeed;
      const driftX = Math.sin(star.sineOffset) * 0.45;

      star.x += star.vx + driftX;
      star.y += star.vy;

      // Wrap around edges for infinite flow
      if (!star.isEphemeral) {
        if (star.y < -10) {
          star.y = this.canvas.height + 10;
          star.x = Math.random() * this.canvas.width;
        }
        if (star.x < -10) star.x = this.canvas.width + 10;
        if (star.x > this.canvas.width + 10) star.x = -10;
      }

      // Render star orb
      this.ctx.save();
      this.ctx.globalAlpha = Math.max(0.08, Math.min(1, star.alpha));
      this.ctx.fillStyle = star.color;
      this.ctx.shadowColor = star.color;
      this.ctx.shadowBlur = star.r * 2.5;

      this.ctx.beginPath();
      this.ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // 2. UPDATE & RENDER 4-POINT SPARKLE STARS
    for (let i = 0; i < this.sparkles.length; i++) {
      const sp = this.sparkles[i];
      sp.rotation += sp.rotSpeed;
      sp.alpha += sp.twinkleSpeed;
      if (sp.alpha > 0.85 || sp.alpha < 0.2) {
        sp.twinkleSpeed = -sp.twinkleSpeed;
      }

      sp.y += sp.vy;
      sp.x += sp.vx;

      if (sp.y < -20) {
        sp.y = this.canvas.height + 20;
        sp.x = Math.random() * this.canvas.width;
      }
      if (sp.x < -20) sp.x = this.canvas.width + 20;
      if (sp.x > this.canvas.width + 20) sp.x = -20;

      this.drawSparkleStar(sp.x, sp.y, sp.size, sp.rotation, sp.color, sp.alpha);
    }

    // 3. UPDATE & RENDER RUNNING SHOOTING STARS
    for (let i = this.shootingStars.length - 1; i >= 0; i--) {
      const star = this.shootingStars[i];
      star.x += star.vx;
      star.y += star.vy;
      star.alpha -= star.decay;

      if (star.alpha <= 0 || star.x < -100 || star.y > this.canvas.height + 100) {
        this.shootingStars.splice(i, 1);
        continue;
      }

      this.drawShootingStar(star);
    }

    // 4. CELEBRATION PARTICLES
    if (this.celebrationParticles.length > 0) {
      for (let i = this.celebrationParticles.length - 1; i >= 0; i--) {
        const p = this.celebrationParticles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.22;
        p.life -= p.decay;

        if (p.life <= 0) {
          this.celebrationParticles.splice(i, 1);
          continue;
        }

        this.ctx.save();
        this.ctx.globalAlpha = p.life;
        this.ctx.fillStyle = p.color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }

    this.raf = requestAnimationFrame(() => this.animate());
  }
}

const particles = new NoorParticles();
window.NoorParticles = particles;

// particles.js

class NoorParticles {
    constructor() {
        this.canvas = document.getElementById('particles-canvas');
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.stars = [];
        this.mode = null; // 'celebration' or 'ramadan'
        this.raf = null;

        this.colors = ['#d4af37', '#facc15', '#ffffff', '#10b981'];

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        if (this.mode === 'ramadan') this.initStars();
    }

    startRamadanBackground() {
        this.mode = 'ramadan';
        this.initStars();
        this.animate();
    }

    initStars() {
        this.stars = [];
        const numStars = Math.floor((this.canvas.width * this.canvas.height) / 10000);
        for (let i = 0; i < numStars; i++) {
            this.stars.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                r: Math.random() * 1.5 + 0.5,
                alpha: Math.random(),
                vx: Math.random() * 0.1 - 0.05,
                vy: Math.random() * -0.5 - 0.1
            });
        }
    }

    triggerCelebration() {
        // Generate burst of confetti
        for (let i = 0; i < 150; i++) {
            this.particles.push({
                x: this.canvas.width / 2,
                y: this.canvas.height / 2,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20 - 5,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.015,
                color: this.colors[Math.floor(Math.random() * this.colors.length)],
                size: Math.random() * 4 + 2
            });
        }

        if (this.mode !== 'ramadan') {
            this.animate();
        }
    }

    animate() {
        if (this.raf) cancelAnimationFrame(this.raf);

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render stars contextually
        if (this.mode === 'ramadan') {
            this.ctx.fillStyle = '#ffffff';
            this.stars.forEach(star => {
                this.ctx.globalAlpha = star.alpha;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
                this.ctx.fill();

                // update
                star.y += star.vy;
                star.x += star.vx;

                if (star.y < 0) {
                    star.y = this.canvas.height;
                    star.x = Math.random() * this.canvas.width;
                }
            });
        }

        // Render confetti particles
        if (this.particles.length > 0) {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                let p = this.particles[i];
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.2; // gravity
                p.life -= p.decay;

                if (p.life <= 0) {
                    this.particles.splice(i, 1);
                    continue;
                }

                this.ctx.globalAlpha = p.life;
                this.ctx.fillStyle = p.color;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }

        this.ctx.globalAlpha = 1.0;

        if (this.mode === 'ramadan' || this.particles.length > 0) {
            this.raf = requestAnimationFrame(() => this.animate());
        } else {
            this.raf = null;
        }
    }
}

const particles = new NoorParticles();
window.NoorParticles = particles;

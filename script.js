class ScrollEngine {
    constructor() {
        // Elements
        this.loader = document.getElementById('loader');
        this.progressText = document.getElementById('progress-text');
        this.progressBar = document.getElementById('progress-bar');

        this.canvas = document.getElementById('hero-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.ambientCanvas = document.getElementById('ambient-canvas');
        this.ambientCtx = this.ambientCanvas ? this.ambientCanvas.getContext('2d') : null;

        this.heroText = document.getElementById('hero-text');
        this.perfToggleBtn = document.getElementById('perf-toggle');

        // Constants & Configuration
        this.frameCount = 242;
        this.currentFramePath = index => `assets/frames/ezgif-frame-${index.toString().padStart(3, '0')}.jpg`;

        // State
        this.images = [];
        this.imagesLoaded = 0;
        this.isReady = false;
        this.state = { frame: 0 };
        this.isHighPerformance = true; // High Performance = Dual Canvas on

        this.init();
    }

    init() {
        this.setupBindings();
        this.preloadImages();

        // Initialize Toggle UI string safely
        if (this.perfToggleBtn) {
            this.perfToggleBtn.innerText = 'Mode: High Performance';
        }
    }

    setupBindings() {
        // Toggle Logic
        if (this.perfToggleBtn) {
            this.perfToggleBtn.addEventListener('click', () => this.togglePerformanceMode());
        }

        // Debounced Resize
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.resizeCanvas(), 250);
        });
    }

    togglePerformanceMode() {
        this.isHighPerformance = !this.isHighPerformance;
        if (this.isHighPerformance) {
            if (this.ambientCanvas) this.ambientCanvas.style.display = 'block';
            this.perfToggleBtn.innerText = 'Mode: High Performance';
        } else {
            if (this.ambientCanvas) this.ambientCanvas.style.display = 'none';
            this.perfToggleBtn.innerText = 'Mode: Optimized';
        }
    }

    preloadImages() {
        for (let i = 1; i <= this.frameCount; i++) {
            const img = new Image();
            img.src = this.currentFramePath(i);

            img.onload = () => this.onImageLoad();
            img.onerror = () => {
                console.error("Failed to load: " + img.src);
                this.onImageLoad();
            };
            this.images.push(img);
        }
    }

    onImageLoad() {
        this.imagesLoaded++;
        const percent = Math.floor((this.imagesLoaded / this.frameCount) * 100);

        // Update Preloader UI
        if (this.progressText) this.progressText.innerText = `${percent}%`;
        if (this.progressBar) this.progressBar.style.width = `${percent}%`;

        // Wait strictly for all images
        if (this.imagesLoaded === this.frameCount) {
            this.isReady = true;

            // Hide Loader cleanly
            if (this.loader) {
                this.loader.classList.add('hidden');
            }

            this.resizeCanvas();
            this.render();
            // Engage animations ONLY after everything is booted
            this.initScrollTrigger();
        }
    }

    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        const width = window.innerWidth;
        const height = window.innerHeight;

        // Foreground Canvas
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;
        this.canvas.style.width = width + "px";
        this.canvas.style.height = height + "px";
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Ambient Canvas
        if (this.ambientCanvas && this.ambientCtx) {
            this.ambientCanvas.width = width * dpr;
            this.ambientCanvas.height = height * dpr;
            this.ambientCanvas.style.width = width + "px";
            this.ambientCanvas.style.height = height + "px";
            this.ambientCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        if (this.isReady) {
            requestAnimationFrame(() => this.render());
        }
    }

    render() {
        // Strict guard against early rendering
        if (!this.isReady || this.images.length === 0) return;

        // Hard clamp logic
        const safeIndex = Math.min(this.frameCount - 1, Math.max(0, this.state.frame));
        const img = this.images[safeIndex];

        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        // Clear viewports mathematically before redraw
        this.ctx.clearRect(0, 0, w, h);
        if (this.ambientCtx) this.ambientCtx.clearRect(0, 0, w, h);

        if (img && img.complete && img.naturalWidth > 0) {
            const canvasRatio = window.innerWidth / window.innerHeight;
            const imgRatio = img.width / img.height;

            // Contain Render for Foreground Canvas
            let drawWidth, drawHeight, offsetX, offsetY;
            if (canvasRatio > imgRatio) {
                drawWidth = window.innerWidth;
                drawHeight = window.innerWidth / imgRatio;
                offsetX = 0;
                offsetY = (window.innerHeight - drawHeight) / 2;
            } else {
                drawWidth = window.innerHeight * imgRatio;
                drawHeight = window.innerHeight;
                offsetX = (window.innerWidth - drawWidth) / 2;
                offsetY = 0;
            }
            this.ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

            // Cover Render for passing into Blurred Ambient Canvas
            if (this.ambientCtx && this.isHighPerformance) {
                const ratioCover = Math.max(window.innerWidth / img.width, window.innerHeight / img.height);
                const rw = img.width * ratioCover;
                const rh = img.height * ratioCover;
                const rx = (window.innerWidth - rw) / 2;
                const ry = (window.innerHeight - rh) / 2;

                this.ambientCtx.drawImage(img, rx, ry, rw, rh);
            }
        }
    }

    initScrollTrigger() {
        gsap.registerPlugin(ScrollTrigger);

        ScrollTrigger.create({
            trigger: ".scroll-section",
            start: "top top",
            end: "bottom bottom",
            scrub: true,
            onUpdate: (self) => {
                // Strict frame mapping onto scrub progress
                this.state.frame = Math.min(this.frameCount - 1, Math.floor(self.progress * (this.frameCount - 1)));
                requestAnimationFrame(() => this.render());

                // Dynamic Headline Overlay
                if (this.heroText) {
                    let newText = "";
                    if (self.progress < 0.33) newText = "UNLEASH THE BEAST";
                    else if (self.progress < 0.66) newText = "CHASE GREATNESS";
                    else newText = "HUNGRY FOR MORE";

                    if (this.heroText.innerText !== newText) {
                        gsap.to(this.heroText, {
                            y: -10, opacity: 0, duration: 0.15, onComplete: () => {
                                this.heroText.innerText = newText;
                                gsap.fromTo(this.heroText, { y: 10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.15 });
                            }
                        });
                    }
                }

                // Subtle Zoom Parallax
                const scaleAmount = 1 + (self.progress * 0.08); // scales from 1x to 1.08x
                this.canvas.style.transform = `scale(${scaleAmount})`;

                if (this.ambientCanvas) {
                    // Compose the parallax scale over the 1.1x CSS scale ensuring edge coverage
                    this.ambientCanvas.style.transform = `scale(${1.1 * scaleAmount})`;
                }
            }
        });

        // Section Reveal Sequences globally
        gsap.utils.toArray('.reveal-section').forEach(section => {
            gsap.to(section, {
                y: 0,
                opacity: 1,
                duration: 0.8,
                ease: "power2.out",
                scrollTrigger: {
                    trigger: section,
                    start: "top 85%", // Engages gracefully before hitting center display
                }
            });
        });
    }
}

// Instantiate engine completely enclosed from global scope
document.addEventListener('DOMContentLoaded', () => {
    new ScrollEngine();
});

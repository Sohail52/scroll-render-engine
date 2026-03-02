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

        // State & Memory Management
        this.imageCache = new Map();
        this.bufferSize = 30; // 15 frames ahead, 15 frames behind
        this.isReady = false;
        this.state = { frame: 0 };
        this.isHighPerformance = true; // High Performance = Dual Canvas on

        this.init();
    }

    init() {
        this.setupBindings();
        this.preloadInitial();

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

    // Load only the first few frames to unblock UI quickly
    preloadInitial() {
        const initialCount = 10;
        let loaded = 0;

        for (let i = 0; i < initialCount; i++) {
            this.loadImage(i, () => {
                loaded++;
                const percent = Math.floor((loaded / initialCount) * 100);

                // Update Preloader UI
                if (this.progressText) this.progressText.innerText = `${percent}%`;
                if (this.progressBar) this.progressBar.style.width = `${percent}%`;

                // Unblock engine once initial frames are loaded
                if (loaded === initialCount) {
                    this.isReady = true;
                    if (this.loader) this.loader.classList.add('hidden');

                    this.resizeCanvas();
                    this.manageBuffer(0); // Start loading frames ahead of user's scroll depth
                    this.render();

                    // Engage animations ONLY after everything is booted
                    this.initScrollTrigger();
                }
            });
        }
    }

    loadImage(index, callback) {
        if (this.imageCache.has(index)) {
            if (callback) callback();
            return;
        }

        // Flag as processing to prevent overlapping network requests
        this.imageCache.set(index, 'loading');

        const img = new Image();
        img.src = this.currentFramePath(index + 1); // filenames are 1-indexed

        img.onload = () => {
            this.imageCache.set(index, img);
            if (callback) callback();

            // Re-render dynamically if user scrubbed to this exact frame while it was loading
            if (this.state.frame === index && this.isReady) {
                requestAnimationFrame(() => this.render());
            }
        };

        img.onerror = () => {
            console.warn("Failed to load: " + img.src);
            this.imageCache.delete(index);
            if (callback) callback();
        };
    }

    manageBuffer(currentFrame) {
        // Find safe window to cache
        const start = Math.max(0, currentFrame - Math.floor(this.bufferSize / 2));
        const end = Math.min(this.frameCount - 1, currentFrame + Math.floor(this.bufferSize / 2));

        // Load frames inside the viewport + buffer threshold
        for (let i = start; i <= end; i++) {
            if (!this.imageCache.has(i)) {
                this.loadImage(i);
            }
        }

        // Extremely aggressive memory eviction to prevent Chrome "Aw, Snap!" Out of Memory Error
        for (const [key, value] of this.imageCache) {
            if (key < start || key > end) {
                if (value instanceof Image) value.src = ""; // Force untether image binary from heap
                this.imageCache.delete(key);
            }
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
        if (!this.isReady) return;

        // Hard clamp logic
        const targetIndex = Math.min(this.frameCount - 1, Math.max(0, this.state.frame));

        let img = null;

        // If the exact frame is loaded, render it.
        if (this.imageCache.get(targetIndex) instanceof Image) {
            img = this.imageCache.get(targetIndex);
        } else {
            // Memory Optimization Fallback: If scrolling faster than network limits, 
            // search outwards sequentially to render the closest cached frame immediately instead of flashing black.
            for (let offset = 1; offset <= this.bufferSize; offset++) {
                if (targetIndex + offset < this.frameCount && this.imageCache.get(targetIndex + offset) instanceof Image) {
                    img = this.imageCache.get(targetIndex + offset); break;
                }
                if (targetIndex - offset >= 0 && this.imageCache.get(targetIndex - offset) instanceof Image) {
                    img = this.imageCache.get(targetIndex - offset); break;
                }
            }
        }

        if (!img || !img.complete || img.naturalWidth === 0) return;

        const dpr = window.devicePixelRatio || 1;
        const w = this.canvas.width / dpr;
        const h = this.canvas.height / dpr;

        // Clear viewports mathematically before redraw
        this.ctx.clearRect(0, 0, w, h);

        // OPTIMIZATION: Only clear ambient canvas if performance mode is active
        if (this.ambientCtx && this.isHighPerformance) {
            this.ambientCtx.clearRect(0, 0, w, h);
        }

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
        // OPTIMIZATION: Only calculate scaling math and draw if performance mode is active
        if (this.ambientCtx && this.isHighPerformance) {
            const ratioCover = Math.max(window.innerWidth / img.width, window.innerHeight / img.height);
            const rw = img.width * ratioCover;
            const rh = img.height * ratioCover;
            const rx = (window.innerWidth - rw) / 2;
            const ry = (window.innerHeight - rh) / 2;

            this.ambientCtx.drawImage(img, rx, ry, rw, rh);
        }
    }

    initScrollTrigger() {
        gsap.registerPlugin(ScrollTrigger);

        ScrollTrigger.create({
            trigger: ".scroll-section",
            start: "top top",
            end: "bottom bottom",
            scrub: true, // Smooths out the buffering fallback logic naturally
            onUpdate: (self) => {
                // Strict frame mapping onto scrub progress
                const previousFrame = this.state.frame;
                this.state.frame = Math.min(this.frameCount - 1, Math.floor(self.progress * (this.frameCount - 1)));

                // Only invoke buffer management if scroll depth has actively changed integers
                if (this.state.frame !== previousFrame) {
                    this.manageBuffer(this.state.frame);
                }

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

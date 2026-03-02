# Nike Scrollytelling Engine

A high-performance, scroll-driven landing page experience powered by Vanilla ES6, HTML5 Canvas, and GSAP. 

## Features
- **GSAP ScrollTrigger**: Hooks a 242-frame sequence to strictly track the user's scroll depth across an 800vh container.
- **Dual Canvas Architecture**: Dynamically renders a sharp foreground element while simultaneously projecting a hardware-accelerated, blurred ambient backdrop to eliminate edge-cropping on ultra-wide screens.
- **Dynamic Preloading**: Blocks render loops until sequence arrays map perfectly to memory, preventing mobile flashes and frame sync drops.
- **Optimized Buffer Management**: Only updates the rendering buffer when frame visual depths have actively changed to save memory and CPU cycles.
- **Performance Toggle**: A real-time UI switch that manipulates the render tree depth, disabling ambient calculations mathematically for power-saving optimization on low-tier devices.

## Running Locally
You can run this project using any local web server. Using Node/NPM:
```bash
npx serve .
```
Navigate to `http://localhost:3000` to view the engine.

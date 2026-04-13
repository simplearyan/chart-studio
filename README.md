# Chart Studio Web

**Chart Studio Web** is a lightweight, strictly vanilla Javascript framework built natively on top of the DOM and `WebCodecs` APIs. No React or heavy view-layer dependencies. It acts as an ultra-fast HTML5 Canvas Timeline Engine built for data animation and high-performance offline video rendering.

## 🚀 Key Features

*   **Interactive Design Studio Editor**
    Clean glassmorphic dark-mode interface split seamlessly across customizable `.md`/JSON schema property inputs on the left, Timeline Canvas Preview tightly bound in the center, and dynamic export configurations housed on the right. Fully responsive across layouts `< 1024px`.
*   **Engine & Playback Core (`Core.js`)**
    Robust `requestAnimationFrame` handler seamlessly managing elapsed times, play/pause state machine, and seeking logic natively integrated into the DOM scale scrubbing slider.
*   **Chart Animations (`ChartObject.js`)**
    Scalable object models mapped to the engine natively resolving CSS animations. Supports `bar`, `line`, and `race` visualizations. Automatically synchronizes easing pipelines natively built over Bezier matrices (`easeInOutCubic`, `easeOutBounce`, `easeOutElastic`).
*   **Dual Dual Export Engine**
    *   **Render Mode (High Quality WebWorker)**: The `mediabunny.worker.js` offline WebCodec renderer guarantees zero frame drops. Extracts sequence frames frame-by-frame utilizing rigorous 15-batch backpressure task queuing asynchronously encoded using native Chromium codec standards mapped strictly into `MP4`/`WEBM`/`MOV` containers perfectly sync'd to pure microseconds.
    *   **Record Mode (Ultra-Fast 60FPS Native Streams)**: Uses standard `canvas.captureStream(FPS)` mapped to `new MediaRecorder` APIs capturing real-time WebGL buffer pushes dynamically saving lightweight output buffers instantaneously seamlessly.

---

## 🛠 Prerequisites & Installation

To run this Vanilla Vite structure:
1. Ensure **Node.js** (>= 18) is installed.
2. Initialize and start the lightweight Vite HMR Web Server.

```bash
npm install
npm run dev
```

---

## 📱 Responsiveness & UX Workflow

Designed exclusively to leverage Mobile First Media Queries, seamlessly shrinking `var(--bg-panel)` elements into vertical column hierarchies preventing horizontal overflow on `max-width: 1024px` constraints ensuring smooth UI transitions. Modern Chrome versions correctly cache the generated Export API artifacts natively avoiding network data corruption.

## 💡 Engine Mechanics (Advanced)

If expanding `ChartObject`, leverage the standard lifecycle methods bound to `engine.render()` loops:
- `.update(time, duration)`: Resolves all dynamic scaling factors utilizing relative interpolation percentages smoothly locking animations entirely irrespective of lag overhead.
- `.draw(ctx)`: Clears and writes exclusively over the 2D native context directly.

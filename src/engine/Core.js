export class Engine {
    constructor(canvasElement) {
        this.canvas = canvasElement;
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        this.objects = [];
        this.totalDuration = 5000; // ms
        this.time = 0;
        this.isPlaying = false;
        this.lastTime = 0;
        
        // Export variables
        this.isExporting = false;
        
        this._bindEvents();
    }

    _bindEvents() {
        this.loop = this.loop.bind(this);
    }

    add(object) {
        this.objects.push(object);
    }

    clearScene() {
        this.objects = [];
    }

    render() {
        // Clear canvas
        if (this.bgTransparent) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000000'; // Default black background
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // Normalize time (0 to 1)
        const progress = Math.min(Math.max(this.time / this.totalDuration, 0), 1);

        // Render all objects
        for (const obj of this.objects) {
            obj.render(this.ctx, this.canvas.width, this.canvas.height, progress);
        }
    }

    play() {
        if (!this.isPlaying) {
            this.isPlaying = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop);
        }
    }

    pause() {
        this.isPlaying = false;
    }

    seek(timeMs) {
        this.time = timeMs;
        if (this.time > this.totalDuration) this.time = this.totalDuration;
        if (this.time < 0) this.time = 0;
        this.render();
    }

    loop(currentTime) {
        if (!this.isPlaying) return;

        const delta = currentTime - this.lastTime;
        this.lastTime = currentTime;
        
        this.time += delta;
        
        if (this.time >= this.totalDuration) {
            this.time = this.totalDuration;
            this.isPlaying = false;
            this.render();
            // Dispatch end event if needed
            window.dispatchEvent(new CustomEvent('engine:ended'));
            return;
        }

        this.render();
        window.dispatchEvent(new CustomEvent('engine:progress', { detail: { time: this.time, duration: this.totalDuration } }));
        requestAnimationFrame(this.loop);
    }
}

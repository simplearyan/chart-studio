// Easing functions
const easings = {
    easeInOutCubic: (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutElastic: (t) => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeOutBounce: (t) => {
        const n1 = 7.5625;
        const d1 = 2.75;
        if (t < 1 / d1) return n1 * t * t;
        if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
        if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
        return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
};

export class ChartObject {
    constructor() {
        this.data = [];
        this.type = 'bar';
        this.palette = ['#8b5cf6', '#6366f1'];
        this.easing = 'easeInOutCubic';
    }

    setData(dataJson, type) {
        try {
            this.data = JSON.parse(dataJson);
        } catch (e) {
            console.error("Invalid JSON Data");
        }
        this.type = type;
    }

    setPalette(paletteStr) {
        if (paletteStr === 'pink-rose') this.palette = ['#ec4899', '#f43f5e'];
        else if (paletteStr === 'emerald-blue') this.palette = ['#10b981', '#3b82f6'];
        else this.palette = ['#a855f7', '#6366f1']; // default purple-indigo
    }

    setEasing(easingStr) {
        this.easing = easings[easingStr] ? easingStr : 'easeInOutCubic';
    }

    render(ctx, width, height, progress) {
        if (!this.data || this.data.length === 0) return;
        
        ctx.save();
        ctx.font = '24px Inter, sans-serif';
        const easeProg = easings[this.easing](progress);
        
        const maxValue = Math.max(...this.data.map(d => Number(d.val)));
        
        if (this.type === 'bar') {
            this._renderBar(ctx, width, height, easeProg, maxValue);
        } else if (this.type === 'line') {
            this._renderLine(ctx, width, height, easeProg, maxValue);
        } else if (this.type === 'race') {
            this._renderRace(ctx, width, height, progress, maxValue); // Race doesn't use the same easing, it sorts over time
        }
        
        ctx.restore();
    }

    _getGradient(ctx, x, y, w, h) {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, this.palette[0]);
        grad.addColorStop(1, this.palette[1]);
        return grad;
    }

    _renderBar(ctx, width, height, progress, maxValue) {
        const padding = 80;
        const availableW = width - (padding * 2);
        const availableH = height - (padding * 2);
        const barWidth = (availableW / this.data.length) - 20;

        for (let i = 0; i < this.data.length; i++) {
            const item = this.data[i];
            const targetH = (item.val / maxValue) * availableH;
            const currentH = targetH * progress;
            
            const x = padding + (i * (barWidth + 20));
            const y = height - padding - currentH;

            // Draw Bar
            ctx.fillStyle = this._getGradient(ctx, x, y, barWidth, currentH);
            this._roundRect(ctx, x, y, barWidth, currentH, 8);
            ctx.fill();

            // Draw Label
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(item.label, x + barWidth/2, height - padding + 30);
            
            // Draw Value
            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.fillText(Math.round(item.val * progress), x + barWidth/2, y - 10);
            ctx.font = '24px Inter, sans-serif';
        }
    }

    _renderLine(ctx, width, height, progress, maxValue) {
        const padding = 80;
        const availableW = width - (padding * 2);
        const availableH = height - (padding * 2);
        const spacing = availableW / Math.max(1, (this.data.length - 1));

        ctx.beginPath();
        const points = [];
        
        for (let i = 0; i < this.data.length; i++) {
            const item = this.data[i];
            const targetY = height - padding - ((item.val / maxValue) * availableH);
            // Easing drives the y position coming up from baseline
            const startY = height - padding;
            const currentY = startY + ((targetY - startY) * progress);
            
            const x = padding + (i * spacing);
            points.push({x, y: currentY, label: item.label, val: item.val});
            
            if (i === 0) ctx.moveTo(x, currentY);
            else ctx.lineTo(x, currentY);
        }

        ctx.strokeStyle = this._getGradient(ctx, padding, padding, availableW, availableH);
        ctx.lineWidth = 6;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        for (const p of points) {
            ctx.beginPath();
            ctx.fillStyle = '#ffffff';
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.stroke(); // strokes with gradient
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText(p.label, p.x, height - padding + 30);
            
            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.fillText(Math.round(p.val * progress), p.x, p.y - 20);
            ctx.font = '24px Inter, sans-serif';
        }
    }
    
    _renderRace(ctx, width, height, progress, maxValue) {
        // Simple race representation where values increase over time based on their index
        // progress goes 0 to 1
        const padding = 80;
        const availableW = width - (padding * 2) - 100; // leaves room for labels
        
        let currentValues = this.data.map((d, i) => {
            // Give each bar a slightly different completion time to simulate a race
            const offset = (i / this.data.length) * 0.5; 
            const localProg = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
            const p = easings[this.easing](localProg);
            return {
                label: d.label,
                val: d.val * p,
                id: i,
                targetVal: d.val
            };
        });
        
        // Sort current values descending
        currentValues.sort((a, b) => b.val - a.val);
        
        const barHeight = 40;
        const spacing = 20;
        
        for (let i = 0; i < currentValues.length; i++) {
            const item = currentValues[i];
            const currentW = (item.val / maxValue) * availableW;
            
            const x = padding + 100; // Shift for labels
            // Target Y depends on current rank
            const y = padding + (i * (barHeight + spacing));
            
            // gradient horizontally
            ctx.fillStyle = this._getGradient(ctx, x, y, currentW, barHeight);
            this._roundRect(ctx, x, y, Math.max(currentW, 5), barHeight, 4);
            ctx.fill();
            
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'right';
            ctx.fillText(item.label, x - 20, y + barHeight/2 + 8);
            
            ctx.textAlign = 'left';
            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.fillText(Math.round(item.val), x + currentW + 10, y + barHeight/2 + 8);
            ctx.font = '24px Inter, sans-serif';
        }
    }

    _roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    }
}

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
        this.theme = 'default';
        this.metadata = {
            headline: '',
            subheadline: '',
            source: ''
        };
        // Advanced Customization Overrides
        this.customBg = null;
        this.customTextColor = null;
        this.smoothing = true; // Bezier curves
        this.lineWidth = 4;
        this.showGrid = true;
    }

    setData(dataJson, type) {
        try {
            const raw = typeof dataJson === 'string' ? JSON.parse(dataJson) : dataJson;
            // Normalize data: ensure all objects have .val and .values where appropriate
            this.data = raw.map(item => {
                const normalized = { ...item };
                
                // If it's a category item with .val but used in line-race
                if (normalized.val !== undefined && normalized.values === undefined) {
                    normalized.values = [normalized.val];
                }
                
                // If it's a series item with .values but used in category charts (bar, race, line)
                if (normalized.values !== undefined && normalized.val === undefined) {
                    normalized.val = normalized.values[normalized.values.length - 1];
                }
                
                return normalized;
            });
        } catch (e) {
            console.error("Invalid JSON Data", e);
            this.data = [];
        }
        this.type = type;
    }

    setPalette(paletteStr) {
        if (paletteStr === 'pink-rose') this.palette = ['#ec4899', '#f43f5e'];
        else if (paletteStr === 'emerald-blue') this.palette = ['#10b981', '#3b82f6'];
        else if (paletteStr === 'vox') this.palette = ['#FFCC00', '#000000']; 
        else if (paletteStr === 'flourish') this.palette = ['#3b82f6', '#2dd4bf'];
        else this.palette = ['#a855f7', '#6366f1']; // default purple-indigo
    }

    setTheme(theme) {
        this.theme = theme;
        if (theme === 'vox') this.setPalette('vox');
        if (theme === 'flourish') this.setPalette('flourish');
    }

    setMetadata(meta) {
        this.metadata = { ...this.metadata, ...meta };
    }

    setCustomStyles(styles) {
        if (styles.bgColor !== undefined) this.customBg = styles.bgColor;
        if (styles.textColor !== undefined) this.customTextColor = styles.textColor;
        if (styles.smoothing !== undefined) this.smoothing = styles.smoothing;
        if (styles.lineWidth !== undefined) this.lineWidth = styles.lineWidth;
        if (styles.showGrid !== undefined) this.showGrid = styles.showGrid;
    }

    setEasing(easingStr) {
        this.easing = easings[easingStr] ? easingStr : 'easeInOutCubic';
    }

    render(ctx, width, height, progress) {
        if (!this.data || this.data.length === 0) return;
        
        ctx.save();
        
        // Render Custom Background
        if (this.customBg) {
            ctx.fillStyle = this.customBg;
            ctx.fillRect(0, 0, width, height);
        }

        // Set Default Typography
        ctx.fillStyle = this.customTextColor || (this.theme === 'vox' ? '#ffffff' : '#f1f5f9');
        if (this.theme === 'vox') {
            ctx.font = '700 24px "Inter", sans-serif';
        } else {
            ctx.font = '24px Inter, sans-serif';
        }
        
        const easeProg = easings[this.easing](progress);
        
        // 1. Render Background/Style layer (Vox accent)
        if (this.theme === 'vox') {
            this._renderVoxBase(ctx, width, height);
        }

        // 2. Render Metadata (Headline, Subheadline)
        this._renderMetadata(ctx, width, height, progress);
        
        // Safety for empty or NaN maxValue
        const getSafeMax = (data) => {
            const m = Math.max(1, ...data.map(d => Number(d.val) || 0));
            return isNaN(m) ? 1 : m;
        };

        // 3. Render Chart
        if (this.type === 'bar') {
            this._renderBar(ctx, width, height, easeProg, getSafeMax(this.data));
        } else if (this.type === 'line') {
            this._renderLine(ctx, width, height, easeProg, getSafeMax(this.data));
        } else if (this.type === 'race') {
            this._renderRace(ctx, width, height, progress, getSafeMax(this.data));
        } else if (this.type === 'line-race') {
            this._renderLineRace(ctx, width, height, progress);
        } else if (this.type === 'area') {
            this._renderArea(ctx, width, height, easeProg, getSafeMax(this.data));
        }
        
        ctx.restore();
    }

    _renderVoxBase(ctx, width, height) {
        ctx.fillStyle = '#FFCC00';
        ctx.fillRect(40, 40, 80, 8); // Top left accent
    }

    _renderMetadata(ctx, width, height, progress) {
        const { headline, subheadline, source } = this.metadata;
        const padding = 60;
        let yOffset = padding + 40;

        const textColor = this.customTextColor || '#ffffff';

        if (this.theme === 'vox') {
            if (headline) {
                ctx.fillStyle = textColor;
                ctx.font = '900 48px "Inter", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(headline.toUpperCase(), padding, yOffset);
                yOffset += 50;
            }
            if (subheadline) {
                ctx.fillStyle = this.customTextColor || '#aaaaaa';
                ctx.font = '400 24px "Inter", sans-serif';
                ctx.fillText(subheadline, padding, yOffset);
                yOffset += 40;
            }
        } else if (this.theme === 'flourish') {
            if (headline) {
                ctx.fillStyle = textColor;
                ctx.font = '700 42px "Merriweather", serif';
                ctx.textAlign = 'left';
                ctx.fillText(headline, padding, yOffset);
                yOffset += 45;
            }
            if (subheadline) {
                ctx.fillStyle = this.customTextColor || '#cccccc';
                ctx.font = '400 20px "Inter", sans-serif';
                ctx.fillText(subheadline, padding, yOffset);
                yOffset += 35;
            }
        }

        if (source) {
            ctx.save();
            ctx.fillStyle = this.customTextColor || '#888888';
            ctx.font = 'italic 16px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(source, padding, height - 30);
            ctx.restore();
        }
    }

    _renderLineRace(ctx, width, height, progress) {
        const paddingLeft = 80;
        const paddingBottom = 100;
        const paddingRight = 150; // extra for labels
        const paddingTop = 200;
        const availableW = width - paddingLeft - paddingRight;
        const availableH = height - paddingBottom - paddingTop;

        // Find global max value and max data length
        let maxVal = -Infinity;
        let maxLen = 0;
        this.data.forEach(s => {
            s.values.forEach(v => { if (v > maxVal) maxVal = v; });
            if (s.values.length > maxLen) maxLen = s.values.length;
        });

        const stepX = availableW / (maxLen - 1);
        const currentPointsTarget = (maxLen - 1) * progress;
        
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        this.data.forEach((series, sIdx) => {
            const color = series.color || (this.theme === 'vox' ? '#FFCC00' : this._getPaletteColor(sIdx));
            ctx.strokeStyle = color;
            ctx.lineWidth = this.lineWidth;

            ctx.beginPath();
            let lastX = 0, lastY = 0;

            for (let i = 0; i < series.values.length; i++) {
                const valProgress = i;
                if (valProgress > currentPointsTarget + 0.1) break; // Don't draw points ahead of progress

                const x = paddingLeft + (i * stepX);
                const y = height - paddingBottom - ((series.values[i] / maxVal) * availableH);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    if (this.smoothing) {
                        const prevX = paddingLeft + ((i - 1) * stepX);
                        const prevY = height - paddingBottom - ((series.values[i - 1] / maxVal) * availableH);
                        ctx.bezierCurveTo(prevX + stepX / 2, prevY, x - stepX / 2, y, x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                lastX = x;
                lastY = y;
            }
            ctx.stroke();

            // Render Leading Label
            ctx.fillStyle = color;
            ctx.font = '700 16px "Inter", sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(series.label, lastX + 15, lastY + 5);
        });

        // Draw Axes
        if (this.showGrid) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(paddingLeft, height - paddingBottom);
            ctx.lineTo(width - paddingRight, height - paddingBottom);
            ctx.stroke();
        }
    }

    _getPaletteColor(index) {
        return this.palette[index % this.palette.length];
    }

    _getGradient(ctx, x, y, w, h) {
        const grad = ctx.createLinearGradient(x, y, x + w, y + h);
        grad.addColorStop(0, this.palette[0]);
        grad.addColorStop(1, this.palette[1]);
        return grad;
    }

    _renderBar(ctx, width, height, progress, maxValue) {
        const paddingLeft = 80;
        const paddingBottom = 100;
        const paddingTop = 200;
        const availableW = width - (paddingLeft * 2);
        const availableH = height - paddingBottom - paddingTop;
        const barWidth = (availableW / this.data.length) - 20;

        for (let i = 0; i < this.data.length; i++) {
            const item = this.data[i];
            const targetH = (item.val / maxValue) * availableH;
            const currentH = targetH * progress;
            
            const x = paddingLeft + (i * (barWidth + 20));
            const y = height - paddingBottom - currentH;

            if (this.theme === 'vox') {
                ctx.fillStyle = '#FFCC00';
                ctx.fillRect(x, y, barWidth, currentH);
            } else {
                ctx.fillStyle = this._getGradient(ctx, x, y, barWidth, currentH);
                this._roundRect(ctx, x, y, barWidth, currentH, 8);
                ctx.fill();
            }

            ctx.fillStyle = this.customTextColor || '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = this.theme === 'vox' ? '700 18px "Inter", sans-serif' : '18px Inter, sans-serif';
            ctx.fillText(item.label, x + barWidth/2, height - paddingBottom + 30);
            
            ctx.font = 'bold 20px Inter, sans-serif';
            ctx.fillText(Math.round(item.val * progress), x + barWidth/2, y - 10);
        }
    }

    _renderLine(ctx, width, height, progress, maxValue) {
        const paddingLeft = 80;
        const paddingBottom = 100;
        const paddingTop = 200;
        const availableW = width - (paddingLeft * 2);
        const availableH = height - paddingBottom - paddingTop;
        const spacing = availableW / Math.max(1, (this.data.length - 1));

        ctx.beginPath();
        const points = [];
        
        for (let i = 0; i < this.data.length; i++) {
            const item = this.data[i];
            const targetY = height - paddingBottom - ((item.val / maxValue) * availableH);
            const startY = height - paddingBottom;
            const currentY = startY + ((targetY - startY) * progress);
            
            const x = paddingLeft + (i * spacing);
            points.push({x, y: currentY, label: item.label, val: item.val});
            
            if (i === 0) ctx.moveTo(x, currentY);
            else ctx.lineTo(x, currentY);
        }

        ctx.strokeStyle = this.theme === 'vox' ? '#FFCC00' : this._getGradient(ctx, paddingLeft, paddingTop, availableW, availableH);
        ctx.lineWidth = this.lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();

        if (this.theme === 'flourish' && progress > 0.1) {
            ctx.save();
            ctx.lineTo(paddingLeft + (this.data.length - 1) * spacing, height - paddingBottom);
            ctx.lineTo(paddingLeft, height - paddingBottom);
            ctx.closePath();
            const fillGrad = ctx.createLinearGradient(0, paddingTop, 0, height - paddingBottom);
            fillGrad.addColorStop(0, 'rgba(45, 212, 191, 0.3)');
            fillGrad.addColorStop(1, 'rgba(45, 212, 191, 0)');
            ctx.fillStyle = fillGrad;
            ctx.fill();
            ctx.restore();
        }

        for (const p of points) {
            ctx.beginPath();
            ctx.fillStyle = this.theme === 'vox' ? '#000000' : '#ffffff';
            ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = this.theme === 'vox' ? '#FFCC00' : '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            ctx.fillStyle = this.customTextColor || '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = '18px Inter, sans-serif';
            ctx.fillText(p.label, p.x, height - paddingBottom + 30);
            
            if (progress > 0.8) {
                ctx.font = 'bold 18px Inter, sans-serif';
                ctx.fillText(Math.round(p.val * progress), p.x, p.y - 20);
            }
        }
    }

    _renderArea(ctx, width, height, progress, maxValue) {
        this._renderLine(ctx, width, height, progress, maxValue);
    }
    
    _renderRace(ctx, width, height, progress, maxValue) {
        const paddingLeft = 200;
        const paddingRight = 100;
        const paddingTop = 200;
        const paddingBottom = 60;
        const availableW = width - paddingLeft - paddingRight;
        const availableH = height - paddingTop - paddingBottom;
        
        let currentValues = this.data.map((d, i) => {
            const offset = (i / this.data.length) * 0.4; 
            const localProg = Math.max(0, Math.min(1, (progress - offset) / (1 - offset)));
            const p = easings[this.easing](localProg);
            return {
                label: d.label,
                val: d.val * p,
                id: i,
                targetVal: d.val
            };
        });
        
        currentValues.sort((a, b) => b.val - a.val);
        
        const barHeight = 35;
        const spacing = 15;
        
        for (let i = 0; i < currentValues.length; i++) {
            const item = currentValues[i];
            const currentW = (item.val / maxValue) * availableW;
            const x = paddingLeft;
            const y = paddingTop + (i * (barHeight + spacing));
            
            if (this.theme === 'vox') {
                ctx.fillStyle = '#FFCC00';
            } else {
                ctx.fillStyle = this._getGradient(ctx, x, y, currentW, barHeight);
            }
            
            this._roundRect(ctx, x, y, Math.max(currentW, 5), barHeight, 4);
            ctx.fill();
            
            ctx.fillStyle = this.customTextColor || '#ffffff';
            ctx.textAlign = 'right';
            ctx.font = '700 18px "Inter", sans-serif';
            ctx.fillText(item.label, x - 20, y + barHeight/2 + 7);
            
            ctx.textAlign = 'left';
            ctx.font = 'bold 18px "Inter", sans-serif';
            ctx.fillText(Math.round(item.val).toLocaleString(), x + currentW + 10, y + barHeight/2 + 7);
        }
    }

    _roundRect(ctx, x, y, width, height, radius) {
        if (width < 0) return;
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


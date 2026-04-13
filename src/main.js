import { Engine } from './engine/Core.js';
import { ChartObject } from './engine/ChartObject.js';
import { toPng } from 'html-to-image';
import download from 'downloadjs';

// Setup Worker
// We use ?worker to let Vite know this is a Web Worker
import MediaWorker from './workers/mediabunny.worker.js?worker';

const appState = {
    chartType: 'bar',
    palette: 'purple-indigo',
    duration: 5,
    easing: 'easeInOutCubic',
    data: ''
};

let engine;
let chartObj;

// DOM Elements
const canvasEl = document.getElementById('main-canvas');
const containerEl = document.getElementById('canvas-container');

// Controls
const btnPlay = document.getElementById('btn-play');
const sliderTimeline = document.getElementById('timeline-slider');
const elTimeCurrent = document.getElementById('time-current');
const elTimeTotal = document.getElementById('time-total');

// Inputs
const dataInput = document.getElementById('data-input');
const btnUpdateData = document.getElementById('btn-update-data');
const typeBtns = document.querySelectorAll('.type-btn');
const paletteBtns = document.querySelectorAll('.palette-swatch');
const confDuration = document.getElementById('conf-duration');
const confEasing = document.getElementById('conf-easing');

// Export
const btnExportPng = document.getElementById('btn-export-png');
const btnExportVideo = document.getElementById('btn-export-video');
const exportOverlay = document.getElementById('export-overlay');
const exportProgressBar = document.getElementById('export-progress-bar');
const exportStatus = document.getElementById('export-status');
const selFormat = document.getElementById('export-format');
const selFps = document.getElementById('export-fps');

function init() {
    engine = new Engine(canvasEl);
    chartObj = new ChartObject();
    engine.add(chartObj);

    // Initial Resize
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Initial Data
    appState.data = dataInput.value;
    updateChart();

    bindEvents();
}

function resizeCanvas() {
    // Keep 16:9 aspect ratio mapping
    const container = containerEl.getBoundingClientRect();
    const targetW = 1280;
    const targetH = 720;
    
    // We keep fixed logical resolution but let CSS scale it.
    engine.render();
}

function updateChart() {
    chartObj.setData(appState.data, appState.chartType);
    chartObj.setPalette(appState.palette);
    chartObj.setEasing(appState.easing);
    engine.totalDuration = appState.duration * 1000;
    elTimeTotal.innerText = appState.duration.toFixed(1);
    
    // reset playback
    sliderTimeline.value = 0;
    engine.seek(0);
}

function bindEvents() {
    btnUpdateData.addEventListener('click', () => {
        appState.data = dataInput.value;
        updateChart();
    });

    typeBtns.forEach(btn => btn.addEventListener('click', (e) => {
        typeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.chartType = btn.dataset.type;
        updateChart();
    }));

    paletteBtns.forEach(btn => btn.addEventListener('click', (e) => {
        paletteBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.palette = btn.dataset.palette;
        updateChart();
    }));

    confDuration.addEventListener('change', (e) => {
        appState.duration = Number(e.target.value);
        updateChart();
    });

    confEasing.addEventListener('change', (e) => {
        appState.easing = e.target.value;
        updateChart();
    });

    btnPlay.addEventListener('click', () => {
        if (engine.isPlaying) {
            engine.pause();
            btnPlay.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
        } else {
            if (engine.time >= engine.totalDuration) {
                engine.seek(0);
            }
            engine.play();
            btnPlay.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>';
        }
    });

    sliderTimeline.addEventListener('input', (e) => {
        const p = e.target.value / 100;
        engine.seek(p * engine.totalDuration);
        elTimeCurrent.innerText = (engine.time / 1000).toFixed(1);
    });

    window.addEventListener('engine:progress', (e) => {
        const { time, duration } = e.detail;
        sliderTimeline.value = (time / duration) * 100;
        elTimeCurrent.innerText = (time / 1000).toFixed(1);
    });

    window.addEventListener('engine:ended', () => {
        btnPlay.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>';
    });

    btnExportPng.addEventListener('click', async () => {
        // We can just use canvas instead of html-to-image since it's all canvas
        const dataUrl = canvasEl.toDataURL('image/png');
        download(dataUrl, 'chart-export.png');
    });

    btnExportVideo.addEventListener('click', handleExportVideo);
}

// ---- VIDEO EXPORT LOGIC USING MEDIABUNNY ----
function handleExportVideo() {
    exportOverlay.classList.remove('hidden');
    exportProgressBar.style.width = '0%';
    exportStatus.innerText = 'Initializing Web Worker...';
    
    // Stop engine
    engine.pause();
    engine.seek(0);
    
    const worker = new MediaWorker();
    const fps = Number(selFps.value);
    const format = selFormat.value;
    const duration = engine.totalDuration;
    const totalFrames = Math.floor((duration / 1000) * fps);
    const dt = 1000 / fps;
    const microDtMs = 1000000 / fps; // microseconds

    worker.onmessage = async (e) => {
        const { type, data, message, error } = e.data;

        if (type === 'READY') {
            exportStatus.innerText = 'Encoding Frames...';
            // Start pushing frames
            let currentFrame = 0;
            
            // Push frames sequentially to avoid OOM
            const pushNextBatch = async () => {
                const BATCH_SIZE = 30; // Max pending frames
                
                while (currentFrame < totalFrames) {
                    // Simple throttle
                    if (currentFrame % BATCH_SIZE === 0 && currentFrame > 0) {
                        // wait a bit for worker to catch up
                        await new Promise(r => setTimeout(r, 50));
                    }
                    
                    const timeMs = currentFrame * dt;
                    engine.seek(timeMs);
                    
                    const bitmap = await createImageBitmap(canvasEl);
                    const timestampObj = currentFrame * microDtMs; 
                    
                    worker.postMessage({
                        type: 'ENCODE_FRAME',
                        data: {
                            bitmap,
                            timestamp: timestampObj,
                            duration: microDtMs
                        }
                    }, [bitmap]);
                    
                    currentFrame++;
                    
                    // UI
                    const progress = (currentFrame / totalFrames) * 90; // Up to 90%
                    exportProgressBar.style.width = `${progress}%`;
                }
                
                // Done
                exportStatus.innerText = 'Finalizing stream...';
                worker.postMessage({ type: 'FINALIZE' });
            };
            
            pushNextBatch();
        } else if (type === 'COMPLETE') {
            exportProgressBar.style.width = `100%`;
            exportStatus.innerText = 'Success! Downloading...';
            
            const blob = new Blob([data], { type: format === 'mp4' ? 'video/mp4' : 'video/webm' });
            const url = URL.createObjectURL(blob);
            download(url, `chart-video.${format}`);
            
            setTimeout(() => {
                exportOverlay.classList.add('hidden');
                worker.terminate();
                engine.seek(0);
            }, 1000);
        } else if (type === 'ERROR') {
            alert('Export Failed: ' + error);
            exportOverlay.classList.add('hidden');
            worker.terminate();
        }
    };

    worker.postMessage({
        type: 'CONFIG',
        data: {
            width: canvasEl.width,
            height: canvasEl.height,
            fps: fps,
            format: format,
            bitrate: 5_000_000
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

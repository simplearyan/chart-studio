import { Engine } from './engine/Core.js';
import { ChartObject } from './engine/ChartObject.js';

// We use ?worker to let Vite know this is a Web Worker
import MediaWorker from './workers/mediabunny.worker.js?worker';
import ZipWorker from './workers/zip.worker.js?worker';

function nativeDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

const appState = {
    chartType: 'bar',
    theme: 'vox',
    duration: 5,
    easing: 'easeInOutCubic',
    data: '',
    metadata: {
        headline: '',
        subheadline: '',
        source: ''
    }
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
const typeBtns = document.querySelectorAll('[data-type]');
const themeBtns = document.querySelectorAll('[data-theme]');
const confDuration = document.getElementById('conf-duration');
const confFps = document.getElementById('conf-fps');

// Metadata Inputs
const inputHeadline = document.getElementById('meta-headline');
const inputSubheadline = document.getElementById('meta-subheadline');
const inputSource = document.getElementById('meta-source');

// Export
const btnExportPng = document.getElementById('btn-export-png');
const btnExportVideo = document.getElementById('btn-export-video');
const exportOverlay = document.getElementById('export-overlay');
const exportProgressBar = document.getElementById('export-progress-bar');
const exportStatus = document.getElementById('export-status');

function init() {
    engine = new Engine(canvasEl);
    chartObj = new ChartObject();
    engine.add(chartObj);

    // Initial Data
    appState.data = dataInput.value;
    updateChart();

    bindEvents();
    
    // Auto-render loop for UI responsiveness
    const loop = () => {
        if (!engine.isPlaying) engine.render();
        requestAnimationFrame(loop);
    };
    loop();
}

function updateChart() {
    chartObj.setData(appState.data, appState.chartType);
    chartObj.setTheme(appState.theme);
    chartObj.setMetadata(appState.metadata);
    chartObj.setEasing(appState.easing);
    
    engine.totalDuration = appState.duration * 1000;
    elTimeTotal.innerText = appState.duration.toFixed(1);
    
    // reset playback
    sliderTimeline.value = 0;
    engine.seek(0);
}

function bindEvents() {
    // Exclusive Accordion Management
    const accordions = document.querySelectorAll('details.accordion');
    accordions.forEach(target => {
        target.addEventListener('toggle', () => {
            if (target.open) {
                accordions.forEach(other => {
                    if (other !== target) other.open = false;
                });
            }
        });
    });

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

    themeBtns.forEach(btn => btn.addEventListener('click', (e) => {
        themeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        appState.theme = btn.dataset.theme;
        updateChart();
    }));

    [inputHeadline, inputSubheadline, inputSource].forEach(el => {
        el.addEventListener('input', () => {
            appState.metadata.headline = inputHeadline.value;
            appState.metadata.subheadline = inputSubheadline.value;
            appState.metadata.source = inputSource.value;
            chartObj.setMetadata(appState.metadata);
        });
    });

    confDuration.addEventListener('change', (e) => {
        appState.duration = Number(e.target.value);
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
        engine.bgTransparent = true;
        engine.render();
        const dataUrl = canvasEl.toDataURL('image/png');
        engine.bgTransparent = false;
        engine.render();
        nativeDownload(dataUrl, 'editorial-snapshot.png');
    });

    btnExportVideo.addEventListener('click', handleExportVideo);
}

// ---- VIDEO EXPORT LOGIC (Imported from main.js style) ----
function handleExportVideo() {
    exportOverlay.classList.remove('hidden');
    exportProgressBar.style.width = '0%';
    
    engine.pause();
    engine.seek(0);
    
    runRenderMode();
}

function runRenderMode() {
    exportStatus.innerText = 'Initializing Editorial Pipeline...';
    
    const worker = new MediaWorker();
    const fps = Number(confFps.value);
    const duration = engine.totalDuration;
    const totalFrames = Math.floor((duration / 1000) * fps);
    const dt = 1000 / fps;
    const microDtMs = 1000000 / fps;

    let currentFrame = 0;
    let pendingFrames = 0;

    worker.onmessage = async (e) => {
        const { type, data, message, error } = e.data;
        if (type === 'READY') {
            exportStatus.innerText = 'Encoding Editorial Frames...';
            const pushNextBatch = async () => {
                while (currentFrame < totalFrames) {
                    if (pendingFrames > 15) {
                        await new Promise(r => setTimeout(r, 20));
                        continue;
                    }
                    const timeMs = currentFrame * dt;
                    engine.seek(timeMs);
                    const bitmap = await createImageBitmap(canvasEl);
                    worker.postMessage({
                        type: 'ENCODE_FRAME',
                        data: {
                            bitmap,
                            timestamp: Math.round(currentFrame * microDtMs),
                            duration: Math.round(microDtMs)
                        }
                    }, [bitmap]);
                    currentFrame++;
                    pendingFrames++;
                    exportProgressBar.style.width = `${(currentFrame / totalFrames) * 90}%`;
                }
                exportStatus.innerText = 'Finalizing Editorial Video...';
                worker.postMessage({ type: 'FINALIZE' });
            };
            pushNextBatch();
        } else if (type === 'COMPLETE') {
            exportProgressBar.style.width = `100%`;
            exportStatus.innerText = 'Success! Downloading...';
            const url = URL.createObjectURL(data instanceof Blob ? data : new Blob([data], { type: 'video/mp4' }));
            nativeDownload(url, `editorial-export-${Date.now()}.mp4`);
            setTimeout(() => {
                exportOverlay.classList.add('hidden');
                worker.terminate();
                engine.seek(0);
            }, 1000);
        } else if (type === 'ERROR') {
            alert('Export Failed: ' + error);
            exportOverlay.classList.add('hidden');
            worker.terminate();
        } else if (type === 'FRAME_DONE') {
            pendingFrames--;
        }
    };

    worker.postMessage({
        type: 'CONFIG',
        data: {
            width: canvasEl.width,
            height: canvasEl.height,
            fps: fps,
            format: 'mp4',
            bitrate: 8_000_000 // Higher bitrate for editorial
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

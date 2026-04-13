import { Engine } from './engine/Core.js';
import { ChartObject } from './engine/ChartObject.js';

function nativeDownload(url, filename) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

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

const formatBtns = document.querySelectorAll('.format-btn');
const processBtns = document.querySelectorAll('.process-btn');
const fpsBtns = document.querySelectorAll('.fps-btn');

let exportState = {
    format: 'mp4',
    process: 'render',
    fps: 60
};

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
        const dataUrl = canvasEl.toDataURL('image/png');
        nativeDownload(dataUrl, 'chart-export.png');
    });

    // Export Toggles
    formatBtns.forEach(btn => btn.addEventListener('click', () => {
        formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        exportState.format = btn.dataset.value;
    }));

    processBtns.forEach(btn => btn.addEventListener('click', () => {
        processBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        exportState.process = btn.dataset.value;
    }));

    fpsBtns.forEach(btn => btn.addEventListener('click', () => {
        fpsBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        exportState.fps = Number(btn.dataset.value);
    }));

    btnExportVideo.addEventListener('click', handleExportVideo);
}

// ---- VIDEO EXPORT LOGIC ----
function handleExportVideo() {
    exportOverlay.classList.remove('hidden');
    exportProgressBar.style.width = '0%';
    
    engine.pause();
    engine.seek(0);
    
    if (exportState.process === 'record') {
        runRecordMode();
    } else {
        runRenderMode();
    }
}

function getMimeType(format) {
    if (format === 'mp4') return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : null;
    if (format === 'mov') return typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('video/quicktime') ? 'video/quicktime' : null;
    return 'video/webm;codecs=vp9';
}

function runRecordMode() {
    const fps = exportState.fps;
    const format = exportState.format;
    
    let mimeType = getMimeType(format);
    
    if (!mimeType && format !== 'webm') {
        alert(`UI Error: Your browser doesn't natively support recording to .${format}. Falling back to .webm for Record mode. (Use Render mode for guaranteed formats).`);
        mimeType = 'video/webm;codecs=vp9';
    }

    exportStatus.innerText = 'Recording Realtime Stream...';
    const stream = canvasEl.captureStream(fps);
    const recorder = new MediaRecorder(stream, { mimeType: mimeType });
    const chunks = [];
    
    recorder.ondataavailable = e => {
        if (e.data.size > 0) chunks.push(e.data);
    };
    
    let recordingProgressInterval;
    
    recorder.onstop = () => {
        clearInterval(recordingProgressInterval);
        exportProgressBar.style.width = `100%`;
        exportStatus.innerText = 'Success! Downloading...';
        
        const outputExt = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('quicktime') ? 'mov' : 'webm';
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
        
        nativeDownload(url, `chart-[record]-[${fps}fps]-[${outputExt.toUpperCase()}]-[${dateStr}].${outputExt}`);
        
        setTimeout(() => {
            exportOverlay.classList.add('hidden');
            engine.seek(0);
        }, 1000);
    };
    
    recorder.start();
    engine.seek(0);
    engine.play();
    
    recordingProgressInterval = setInterval(() => {
        const progress = Math.min((engine.time / engine.totalDuration) * 100, 100);
        exportProgressBar.style.width = `${progress}%`;
    }, 100);
    
    const stopListener = () => {
        recorder.stop();
        window.removeEventListener('engine:ended', stopListener);
    };
    window.addEventListener('engine:ended', stopListener);
}

function runRenderMode() {
    exportStatus.innerText = 'Initializing Web Worker...';
    
    const worker = new MediaWorker();
    const fps = exportState.fps;
    const format = exportState.format;
    const duration = engine.totalDuration;
    const totalFrames = Math.floor((duration / 1000) * fps);
    const dt = 1000 / fps;
    const microDtMs = 1000000 / fps; // microseconds

    let currentFrame = 0;
    let pendingFrames = 0;

    worker.onmessage = async (e) => {
        const { type, data, message, error } = e.data;

        if (type === 'READY') {
            exportStatus.innerText = 'Encoding Frames...';
            // Start pushing frames
            
            const pushNextBatch = async () => {
                while (currentFrame < totalFrames) {
                    if (pendingFrames > 15) {
                        await new Promise(r => setTimeout(r, 20));
                        continue;
                    }
                    
                    const timeMs = currentFrame * dt;
                    engine.seek(timeMs);
                    
                    const bitmap = await createImageBitmap(canvasEl);
                    const timestampObj = Math.round(currentFrame * microDtMs); 
                    const durationObj = Math.round(microDtMs);
                    
                    worker.postMessage({
                        type: 'ENCODE_FRAME',
                        data: {
                            bitmap,
                            timestamp: timestampObj,
                            duration: durationObj
                        }
                    }, [bitmap]);
                    
                    currentFrame++;
                    pendingFrames++;
                    
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
            
            let mimeType = 'video/webm';
            if (format === 'mp4') mimeType = 'video/mp4';
            if (format === 'mov') mimeType = 'video/quicktime';
            
            const blob = new Blob([data], { type: mimeType });
            const url = URL.createObjectURL(blob);
            
            const now = new Date();
            const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}-${String(now.getMinutes()).padStart(2,'0')}-${String(now.getSeconds()).padStart(2,'0')}`;
            
            nativeDownload(url, `chart-[render]-[${fps}fps]-[${format.toUpperCase()}]-[${dateStr}].${format}`);
            
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
            format: format,
            bitrate: 5_000_000
        }
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);

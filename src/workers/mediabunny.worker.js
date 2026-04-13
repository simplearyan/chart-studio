import {
    Output,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    MovOutputFormat,
    VideoSampleSource,
    VideoSample
} from 'mediabunny';

let output = null;
let target = null;
let source = null;

let pendingFrames = 0;
let lastProgressUpdate = 0;

const sendProgress = (force = false) => {
    const now = Date.now();
    if (force || now - lastProgressUpdate > 50) {
        self.postMessage({
            type: 'PROGRESS',
            data: { queueSize: pendingFrames }
        });
        lastProgressUpdate = now;
    }
};

const taskQueue = [];
let isProcessing = false;

const processQueue = async () => {
    if (isProcessing || taskQueue.length === 0) return;
    isProcessing = true;

    try {
        while (taskQueue.length > 0) {
            const data = taskQueue.shift();
            const { bitmap, timestamp, duration } = data;

            try {
                if (!source) throw new Error("Source not initialized");

                const frame = new VideoFrame(bitmap, {
                    timestamp: Math.round(timestamp),
                    duration: duration ? Math.round(duration) : undefined
                });

                const sample = new VideoSample(frame);
                try {
                    await source.add(sample);
                } catch (e) {
                    console.error("Frame Encode Error:", e);
                    self.postMessage({ type: 'LOG', message: `Frame Encode Error: ${e.message} @ ${timestamp}` });
                    throw e;
                } finally {
                    sample.close();
                    frame.close();
                    bitmap.close();
                }

                self.postMessage({ type: 'FRAME_DONE' });
            } catch (err) {
                self.postMessage({ type: 'ERROR', error: err.message });
                taskQueue.length = 0;
            }

            pendingFrames--;
            sendProgress(true);
        }
    } finally {
        isProcessing = false;
    }
};

self.onmessage = async (e) => {
    const { type, data } = e.data;

    try {
        if (type === 'CONFIG') {
            const config = data;
            target = new BufferTarget();

            let format;
            if (config.format === 'webm') format = new WebMOutputFormat();
            else if (config.format === 'mov') format = new MovOutputFormat();
            else format = new Mp4OutputFormat();

            output = new Output({
                target,
                format
            });

            const codec = config.format === 'webm' ? 'vp9' : 'avc';

            source = new VideoSampleSource({
                width: config.width,
                height: config.height,
                frameRate: config.fps,
                codec: codec,
                bitrate: config.bitrate || 6000000
            });

            await output.addVideoTrack(source);
            await output.start();

            self.postMessage({ type: 'READY' });
        }
        else if (type === 'ENCODE_FRAME') {
            pendingFrames++;
            sendProgress();
            taskQueue.push(data);
            processQueue();
        }
        else if (type === 'FINALIZE') {
            const drainQueue = async () => {
                while (taskQueue.length > 0 || isProcessing) {
                    await new Promise(r => setTimeout(r, 50));
                }
            };
            await drainQueue();

            try {
                if (source) {
                    if (source.close) {
                        await source.close();
                    }
                }

                if (output) {
                    await output.finalize();
                }

                let attempts = 0;
                while (!target?.buffer && attempts < 100) {
                    await new Promise(r => setTimeout(r, 100));
                    attempts++;
                }

                if (target && target.buffer) {
                    self.postMessage({ type: 'COMPLETE', data: target.buffer }, [target.buffer]);
                } else {
                    throw new Error("Export failed: Buffer empty after finalize.");
                }
            } catch (err) {
                self.postMessage({ type: 'ERROR', error: `Finalize Error: ${err.message}` });
            }
        }
    } catch (err) {
        console.error(err);
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};

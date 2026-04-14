import JSZip from 'jszip';

let zip = null;
let canvas = null;
let ctx = null;
let frameCount = 0;

self.onmessage = async (e) => {
    const { type, data } = e.data;

    try {
        if (type === 'CONFIG') {
            zip = new JSZip();
            frameCount = 0;
            canvas = new OffscreenCanvas(data.width, data.height);
            ctx = canvas.getContext('2d');
            self.postMessage({ type: 'READY' });
        } 
        else if (type === 'ENCODE_FRAME') {
            const { bitmap, timestamp } = data;
            
            // Draw to offscreen canvas to convert to Blob
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(bitmap, 0, 0);
            
            const blob = await canvas.convertToBlob({ type: 'image/png' });
            
            // Add to zip. Pad frame number for sorting
            const filename = `frame_${String(frameCount).padStart(5, '0')}.png`;
            zip.file(filename, blob);
            
            frameCount++;
            bitmap.close();
            
            self.postMessage({ type: 'FRAME_DONE' });
        } 
        else if (type === 'FINALIZE') {
            self.postMessage({ type: 'LOG', message: 'Generating ZIP archive...' });
            const content = await zip.generateAsync({ type: 'blob' });
            self.postMessage({ type: 'COMPLETE', data: content }, [content]);
        }
    } catch (err) {
        self.postMessage({ type: 'ERROR', error: err.message });
    }
};

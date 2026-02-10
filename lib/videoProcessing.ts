
/**
 * VixReel Video Processing Utility
 * Handles client-side video compositing to add a branded watermark outro.
 */

export const downloadVideoWithWatermark = async (
  videoUrl: string,
  username: string,
  onProgress?: (progress: number) => void
): Promise<void> => {
  return new Promise(async (resolve, reject) => {
    try {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.muted = true;
      video.playsInline = true;

      await new Promise((res) => {
        video.onloadedmetadata = res;
        video.onerror = () => reject(new Error("Failed to load video source."));
      });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) return reject(new Error("Canvas context not available."));

      // Set canvas to video dimensions
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const stream = canvas.captureStream(30); // 30 FPS
      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
        videoBitsPerSecond: 5000000 // 5Mbps for quality
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `VixReel_${username}_${Date.now()}.mp4`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      };

      recorder.start();
      video.play();

      const drawFrame = () => {
        if (video.ended) {
          // Video finished, start the outro
          drawOutro();
          return;
        }

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Add small watermark during video (optional, but professional)
        ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillText(`@${username} on VixReel`, 30, canvas.height - 30);

        if (onProgress) {
          onProgress((video.currentTime / video.duration) * 0.8);
        }

        requestAnimationFrame(drawFrame);
      };

      const drawOutro = () => {
        let startTime = Date.now();
        const outroDuration = 2000; // 2 seconds

        const animateOutro = () => {
          const elapsed = Date.now() - startTime;
          const progress = elapsed / outroDuration;

          if (progress >= 1) {
            recorder.stop();
            return;
          }

          // Background
          ctx.fillStyle = '#000000';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          // VixReel Gradient Logo Text
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
          gradient.addColorStop(0, '#ff0080');
          gradient.addColorStop(0.5, '#7928ca');
          gradient.addColorStop(1, '#0070f3');

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Animate logo scale
          const scale = 1 + Math.sin(progress * Math.PI) * 0.1;
          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(scale, scale);

          ctx.font = 'bold 80px "Satisfy", cursive';
          ctx.fillStyle = gradient;
          ctx.fillText('VixReel', 0, -20);

          ctx.font = 'bold 20px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`Created by @${username}`, 0, 60);
          
          ctx.restore();

          if (onProgress) {
            onProgress(0.8 + (progress * 0.2));
          }

          requestAnimationFrame(animateOutro);
        };

        animateOutro();
      };

      drawFrame();
    } catch (err) {
      reject(err);
    }
  });
};

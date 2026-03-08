
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

      // Ensure fonts are loaded for the watermark
      try {
        await document.fonts.load('bold 100px "Satisfy"');
        await document.fonts.load('600 24px "Plus Jakarta Sans"');
      } catch (e) { console.warn("Fonts could not be loaded for watermark, using fallback."); }

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
        const outroDuration = 2500; // Slightly longer for better impact

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

          // Animated Gradient for "Shimmer" effect
          const shimmerOffset = Math.sin(progress * Math.PI * 2) * 0.2;
          const gradient = ctx.createLinearGradient(
            canvas.width * (0.2 + shimmerOffset), 0, 
            canvas.width * (0.8 + shimmerOffset), canvas.height
          );
          gradient.addColorStop(0, '#ff0080'); // Vix Pink
          gradient.addColorStop(0.5, '#7928ca'); // Vix Purple
          gradient.addColorStop(1, '#0070f3'); // Vix Blue

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // Animate logo scale and rotation
          // Elastic pop-in effect
          let scale = 1;
          if (progress < 0.2) {
            scale = (progress / 0.2) * 1.2;
          } else if (progress < 0.4) {
            scale = 1.2 - ((progress - 0.2) / 0.2) * 0.2;
          } else {
            scale = 1 + Math.sin((progress - 0.4) * Math.PI * 4) * 0.02;
          }

          const rotation = Math.sin(progress * Math.PI * 2) * 0.02;

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);
          ctx.scale(scale, scale);
          ctx.rotate(rotation);

          // Add Glow
          ctx.shadowColor = 'rgba(255, 0, 128, 0.5)';
          ctx.shadowBlur = 20 + Math.sin(progress * Math.PI * 4) * 10;

          // Main Logo
          ctx.font = 'bold 100px "Satisfy", cursive';
          ctx.fillStyle = gradient;
          ctx.fillText('VixReel', 0, -30);

          // Reset shadow for subtitle
          ctx.shadowBlur = 0;
          
          // Subtitle with fade in
          const subtitleOpacity = Math.min(1, Math.max(0, (progress - 0.3) * 2));
          ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = `rgba(255, 255, 255, ${subtitleOpacity})`;
          ctx.letterSpacing = '4px';
          ctx.fillText(`@${username.toUpperCase()}`, 0, 60);
          
          // Decorative line
          ctx.beginPath();
          ctx.moveTo(-100 * subtitleOpacity, 100);
          ctx.lineTo(100 * subtitleOpacity, 100);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 2;
          ctx.stroke();

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

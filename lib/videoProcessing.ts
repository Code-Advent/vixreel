
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
        const outroDuration = 3000; // 3 seconds for the outro

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

          // Dynamic Scaling based on canvas size
          const baseScale = canvas.height / 1080;
          const logoSize = 180 * baseScale;
          const handleSize = 32 * baseScale;

          // Animated Gradient for "Shimmer" effect - matching CSS vix-shimmer
          const shimmerOffset = (progress * 2) % 1;
          const gradient = ctx.createLinearGradient(
            -canvas.width * 0.5 + (canvas.width * 2 * shimmerOffset), 0, 
            canvas.width * 0.5 + (canvas.width * 2 * shimmerOffset), 0
          );
          gradient.addColorStop(0, '#ff0080');
          gradient.addColorStop(0.33, '#7928ca');
          gradient.addColorStop(0.66, '#0070f3');
          gradient.addColorStop(1, '#ff0080');

          ctx.save();
          ctx.translate(canvas.width / 2, canvas.height / 2);

          // Animate logo scale - elastic pop
          let scale = 1;
          if (progress < 0.15) {
            scale = (progress / 0.15) * 1.15;
          } else if (progress < 0.3) {
            scale = 1.15 - ((progress - 0.15) / 0.15) * 0.15;
          } else {
            scale = 1 + Math.sin((progress - 0.3) * Math.PI * 2) * 0.01;
          }

          ctx.scale(scale, scale);

          // Add Glow effect
          ctx.shadowColor = 'rgba(255, 0, 128, 0.6)';
          ctx.shadowBlur = 40 * baseScale * (1 + Math.sin(progress * Math.PI * 4) * 0.2);

          // Main Logo - Massive Typography
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.font = `bold ${logoSize}px "Satisfy", cursive`;
          ctx.fillStyle = gradient;
          ctx.fillText('VixReel', 0, -40 * baseScale);

          // Reset shadow for subtitle
          ctx.shadowBlur = 0;
          
          // Subtitle with fade in and slide up
          const subtitleOpacity = Math.min(1, Math.max(0, (progress - 0.2) * 3));
          const subtitleY = 80 * baseScale - (10 * baseScale * (1 - subtitleOpacity));
          
          ctx.font = `800 ${handleSize}px "Plus Jakarta Sans", sans-serif`;
          ctx.fillStyle = `rgba(255, 255, 255, ${subtitleOpacity * 0.9})`;
          ctx.letterSpacing = `${6 * baseScale}px`;
          ctx.fillText(`@${username.toUpperCase()}`, 0, subtitleY);
          
          // Decorative line
          const lineWidth = 120 * baseScale * subtitleOpacity;
          ctx.beginPath();
          ctx.moveTo(-lineWidth, subtitleY + 40 * baseScale);
          ctx.lineTo(lineWidth, subtitleY + 40 * baseScale);
          ctx.strokeStyle = gradient;
          ctx.lineWidth = 4 * baseScale;
          ctx.lineCap = 'round';
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

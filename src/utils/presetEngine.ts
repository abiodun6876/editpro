import { PresetSettings, ManualSettings } from '../data/presets';

export const processImage = async (
    imageSrc: string,
    preset: PresetSettings,
    manualSettings?: ManualSettings
): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageSrc;

        img.onload = async () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d', { willReadFrequently: true })!;

            canvas.width = img.width;
            canvas.height = img.height;

            // Draw initial image
            ctx.drawImage(img, 0, 0);

            const {
                exposure = 1, whites = 1, blacks = 1, contrast = 1,
                highlights = 1, shadows = 1, saturation = 1, vibrance = 1,
                texture = 0, clarity = 0, dehaze = 0, temp = 0, tint = 0,
                sharpness = 0, skinSoftening = 0,
                dodgeBurn = 0,
                sharpenRadius = 1.0, sharpenDetail = 25, vignette = 0,
                watermarkText = '', watermarkOpacity = 0.8, watermarkSize = 20, watermarkColor = '#ffffff',
                whiteOverlay = 0, blackOverlay = 0, disabledSections = {}
            } = manualSettings || {};

            // White Balance Helpers
            const applyWB = (r: number, g: number, b: number, t: number, tn: number) => {
                r += t * 0.5; b -= t * 0.5;
                g -= tn * 0.5; r += tn * 0.25; b += tn * 0.25;
                return { r, g, b };
            };

            // --- Step 1: Basic & Color Correction (Order: WB -> Exposure -> Tones) ---
            let imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imgData.data;

            if (!disabledSections['basic']) {
                for (let i = 0; i < data.length; i += 4) {
                    let r = data[i], g = data[i + 1], b = data[i + 2];

                    // 1. White Balance (Professional Baseline)
                    const wb = applyWB(r, g, b, (preset.colorBalance?.temp || 0) + temp, (preset.colorBalance?.tint || 0) + tint);
                    r = wb.r; g = wb.g; b = wb.b;

                    // 2. Exposure & Tones
                    r = r * exposure * (whites ?? 1);
                    g = g * exposure * (whites ?? 1);
                    b = b * exposure * (whites ?? 1);
                    const bOffset = ((blacks ?? 1) - 1) * 50;
                    r += bOffset; g += bOffset; b += bOffset;

                    // 3. Dehaze
                    if (dehaze !== 0) {
                        const dFactor = dehaze * 0.3;
                        r = (r - 128) * (1 + dFactor) + 128 + (dehaze * 15);
                        g = (g - 128) * (1 + dFactor) + 128 + (dehaze * 15);
                        b = (b - 128) * (1 + dFactor) + 128 + (dehaze * 15);
                    }

                    data[i] = Math.max(0, Math.min(255, r));
                    data[i + 1] = Math.max(0, Math.min(255, g));
                    data[i + 2] = Math.max(0, Math.min(255, b));
                }
                ctx.putImageData(imgData, 0, 0);
            }

            // --- Step 2: Presence & CSS Base ---
            const bufferCanvas = document.createElement('canvas');
            bufferCanvas.width = canvas.width;
            bufferCanvas.height = canvas.height;
            const bctx = bufferCanvas.getContext('2d', { willReadFrequently: true })!;
            bctx.filter = preset.filters + ` contrast(${contrast}) saturate(${saturation})`;
            bctx.drawImage(canvas, 0, 0);

            // --- Step 3: Advanced Pixel Engine (Sharpening, Retouching) ---
            const pixelData = bctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = pixelData.data;

            // Blur buffers for Texture/Clarity/Skin
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
            const tctx = tempCanvas.getContext('2d')!;

            tctx.filter = `blur(2px)`;
            tctx.drawImage(bufferCanvas, 0, 0);
            const fineBlurred = tctx.getImageData(0, 0, canvas.width, canvas.height).data;

            tctx.clearRect(0, 0, canvas.width, canvas.height);
            tctx.filter = `blur(12px)`;
            tctx.drawImage(bufferCanvas, 0, 0);
            const mediumBlurred = tctx.getImageData(0, 0, canvas.width, canvas.height).data;

            tctx.clearRect(0, 0, canvas.width, canvas.height);
            const fsRadius = preset.frequencySeparation?.radius || 8;
            tctx.filter = `blur(${fsRadius}px)`;
            tctx.drawImage(bufferCanvas, 0, 0);
            const fsBlurred = tctx.getImageData(0, 0, canvas.width, canvas.height).data;

            // Detail Panel: Unsharp Mask Simulation
            if (!disabledSections['detail'] && (sharpness > 0)) {
                const blurCanvas = document.createElement('canvas');
                blurCanvas.width = canvas.width; blurCanvas.height = canvas.height;
                const blctx = blurCanvas.getContext('2d')!;
                blctx.filter = `blur(${sharpenRadius}px)`;
                blctx.drawImage(bufferCanvas, 0, 0);
                const blurredData = blctx.getImageData(0, 0, canvas.width, canvas.height).data;
                const intensity = sharpness * (0.5 + sharpenDetail / 50);

                for (let i = 0; i < pixels.length; i += 4) {
                    pixels[i] += (pixels[i] - blurredData[i]) * intensity;
                    pixels[i + 1] += (pixels[i + 1] - blurredData[i + 1]) * intensity;
                    pixels[i + 2] += (pixels[i + 2] - blurredData[i + 2]) * intensity;
                }
            }

            for (let i = 0; i < pixels.length; i += 4) {
                let r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];

                // 1. Texture & Clarity (Presence)
                if (texture !== 0) {
                    r += (r - fineBlurred[i]) * texture * 0.8;
                    g += (g - fineBlurred[i + 1]) * texture * 0.8;
                    b += (b - fineBlurred[i + 2]) * texture * 0.8;
                }
                if (clarity !== 0) {
                    r += (r - mediumBlurred[i]) * clarity * 0.5;
                    g += (g - mediumBlurred[i + 1]) * clarity * 0.5;
                    b += (b - mediumBlurred[i + 2]) * clarity * 0.5;
                }

                // 2. Vibrance
                if (vibrance !== 1) {
                    const max = Math.max(r, g, b), min = Math.min(r, g, b);
                    const l = (max + min) / 510;
                    const s = max === min ? 0 : l > 0.5 ? (max - min) / (510 - max - min) : (max - min) / (max + min);
                    const saturationMultiplier = (1 - s) * (vibrance - 1);
                    const vFactor = 1 + saturationMultiplier;
                    r = l * 255 + (r - l * 255) * vFactor;
                    g = l * 255 + (g - l * 255) * vFactor;
                    b = l * 255 + (b - l * 255) * vFactor;
                }

                // 3. Skin Retouch (Neural AI Logic)
                if (!disabledSections['retouch']) {
                    const isSkin = (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15);
                    if (isSkin) {
                        const blend = (skinSoftening * 0.6 + (texture < 0 ? Math.abs(texture) : 0)) * 0.8;
                        r = r * (1 - blend) + fsBlurred[i] * blend;
                        g = g * (1 - blend) + fsBlurred[i + 1] * blend;
                        b = b * (1 - blend) + fsBlurred[i + 2] * blend;

                        if (dodgeBurn > 0) {
                            const boost = 1 + ((r + g + b) / 3 - 128) / 128 * dodgeBurn * 0.4;
                            r *= boost; g *= boost; b *= boost;
                        }
                    }
                }

                pixels[i] = Math.max(0, Math.min(255, r));
                pixels[i + 1] = Math.max(0, Math.min(255, g));
                pixels[i + 2] = Math.max(0, Math.min(255, b));
            }
            bctx.putImageData(pixelData, 0, 0);

            // --- Step 4: Effects & Overlays ---

            // Manual Vignette
            if (vignette > 0) {
                const grad = bctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.8);
                grad.addColorStop(0.4, 'transparent');
                grad.addColorStop(1, `rgba(0,0,0,${vignette})`);
                bctx.fillStyle = grad; bctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            // Tonal Overlays
            if (!disabledSections['effects']) {
                if (whiteOverlay > 0) {
                    bctx.fillStyle = `rgba(255,255,255,${whiteOverlay * 0.3})`;
                    bctx.globalCompositeOperation = 'screen';
                    bctx.fillRect(0, 0, canvas.width, canvas.height);
                    bctx.globalCompositeOperation = 'source-over';
                }
                if (blackOverlay > 0) {
                    bctx.fillStyle = `rgba(0,0,0,${blackOverlay})`;
                    bctx.globalCompositeOperation = 'multiply';
                    bctx.fillRect(0, 0, canvas.width, canvas.height);
                    bctx.globalCompositeOperation = 'source-over';
                }
            }

            // Watermark / Signature
            if (!disabledSections['watermark'] && watermarkText && watermarkOpacity > 0) {
                const fontSize = (canvas.width / 100) * watermarkSize;
                bctx.font = `bold ${fontSize}px "Inter", sans-serif`;
                bctx.fillStyle = watermarkColor;
                bctx.globalAlpha = watermarkOpacity;
                bctx.textAlign = 'right';
                bctx.textBaseline = 'bottom';
                bctx.shadowColor = 'rgba(0,0,0,0.5)';
                bctx.shadowBlur = fontSize / 10;
                bctx.fillText(watermarkText, canvas.width - fontSize, canvas.height - fontSize);
                bctx.globalAlpha = 1.0;
                bctx.shadowBlur = 0;
            }

            resolve(bufferCanvas.toDataURL('image/jpeg', 0.95));
        };
    });
};

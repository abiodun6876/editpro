import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl'; // Explicitly register WebGL backend
import * as bodyPix from '@tensorflow-models/body-pix';

let net: bodyPix.BodyPix | null = null;

export const loadModels = async () => {
    if (!net) {
        // Ensure the backend is initialized first
        await tf.ready();

        // Use the MobileNetV1 architecture for better performance in the browser
        net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
    }
    return net;
};

export const segmentSubject = async (imageElement: HTMLImageElement) => {
    const model = await loadModels();
    const segmentation = await model.segmentPerson(imageElement, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7
    });
    return segmentation;
};

/**
 * Creates a subject mask that can be used for Bokeh or Background swaps.
 * Pure mathematical alpha masking.
 */
export const createMask = (segmentation: any, width: number, height: number): Uint8ClampedArray => {
    const mask = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < segmentation.data.length; i++) {
        const isSubject = segmentation.data[i] === 1;
        const idx = i * 4;
        mask[idx] = isSubject ? 255 : 0;     // R
        mask[idx + 1] = isSubject ? 255 : 0; // G
        mask[idx + 2] = isSubject ? 255 : 0; // B
        mask[idx + 3] = isSubject ? 255 : 0; // A
    }
    return mask;
};

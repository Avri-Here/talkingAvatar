/* eslint-disable operator-assignment */
/* eslint-disable object-shorthand */
import { useCallback, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCamera } from '@/context/camera-context';
import { useScreenCaptureContext } from '@/context/screen-capture-context';
import { toaster } from "@/components/ui/toaster";
import { loadConfig } from '@/utils/config-loader';

const DEFAULT_IMAGE_COMPRESSION_QUALITY = 0.8;
const DEFAULT_IMAGE_MAX_WIDTH = 512;

// Add type definition for ImageCapture
declare class ImageCapture {
  constructor(track: MediaStreamTrack);

  grabFrame(): Promise<ImageBitmap>;
}

interface ImageData {
  source: 'camera' | 'screen';
  data: string;
  mime_type: string;
}

export function useMediaCapture() {
  const { t } = useTranslation();
  const { stream: cameraStream } = useCamera();
  const { stream: screenStream } = useScreenCaptureContext();
  const [compressionQuality, setCompressionQuality] = useState(DEFAULT_IMAGE_COMPRESSION_QUALITY);
  const [imageMaxWidth, setImageMaxWidth] = useState(DEFAULT_IMAGE_MAX_WIDTH);

  useEffect(() => {
    loadConfig().then((config) => {
      setCompressionQuality(config.general.imageCompressionQuality);
      setImageMaxWidth(config.general.imageMaxWidth);
    }).catch((error) => {
      console.error('Failed to load image config:', error);
    });
  }, []);

  const getCompressionQuality = useCallback(() => compressionQuality, [compressionQuality]);
  const getImageMaxWidth = useCallback(() => imageMaxWidth, [imageMaxWidth]);

  const captureFrame = useCallback(async (stream: MediaStream | null, source: 'camera' | 'screen') => {
    if (!stream) {
      console.warn(`No ${source} stream available`);
      return null;
    }

    const videoTrack = stream.getVideoTracks()[0];
    if (!videoTrack) {
      console.warn(`No video track in ${source} stream`);
      return null;
    }

    const imageCapture = new ImageCapture(videoTrack);
    try {
      const bitmap = await imageCapture.grabFrame();
      const canvas = document.createElement('canvas');
      let { width, height } = bitmap;

      const maxWidth = getImageMaxWidth();
      if (maxWidth > 0 && width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return null;
      }

      ctx.drawImage(bitmap, 0, 0, width, height);
      const quality = getCompressionQuality();
      return canvas.toDataURL('image/jpeg', quality);
    } catch (error) {
      console.error(`Error capturing ${source} frame:`, error);
      toaster.create({
        title: `${t('error.failedCapture', { source: source })}: ${error}`,
        type: 'error',
        duration: 2000,
      });
      return null;
    }
  }, [t, getCompressionQuality, getImageMaxWidth]);

  const captureAllMedia = useCallback(async () => {
    const images: ImageData[] = [];

    // Capture camera frame
    if (cameraStream) {
      const cameraFrame = await captureFrame(cameraStream, 'camera');
      if (cameraFrame) {
        images.push({
          source: 'camera',
          data: cameraFrame,
          mime_type: 'image/jpeg',
        });
      }
    }

    // Capture screen frame
    if (screenStream) {
      const screenFrame = await captureFrame(screenStream, 'screen');
      if (screenFrame) {
        images.push({
          source: 'screen',
          data: screenFrame,
          mime_type: 'image/jpeg',
        });
      }
    }

    console.log("images: ", images);

    return images;
  }, [cameraStream, screenStream, captureFrame]);

  return {
    captureAllMedia,
  };
}

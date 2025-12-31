import { defineConfig, normalizePath } from 'vite';
import path from 'path';
import react from '@vitejs/plugin-react-swc';

const createConfig = async (outDir: string) => ({
  plugins: [
    (await import('vite-plugin-static-copy')).viteStaticCopy({
      targets: [
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_v5.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/@ricky0123/vad-web/dist/silero_vad_legacy.onnx')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'node_modules/onnxruntime-web/dist/*.wasm')),
          dest: './libs/',
        },
        {
          src: normalizePath(path.resolve(__dirname, 'src/renderer/WebSDK/Core/live2dcubismcore.js')),
          dest: './libs/',
        },
      ],
    }),
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src/renderer/src"),
      "@framework": path.resolve(__dirname, "./src/renderer/WebSDK/Framework/src"),
      "@cubismsdksamples": path.resolve(__dirname, "./src/renderer/WebSDK/src"),
      "@motionsyncframework": path.resolve(
        __dirname,
        "./src/renderer/MotionSync/Framework/src",
      ),
      "@motionsync": path.resolve(__dirname, "./src/renderer/MotionSync/src"),
      "/src": path.resolve(__dirname, "./src/renderer/src"),
    },
  },
  root: path.join(__dirname, "src/renderer"),
  publicDir: path.join(__dirname, "src/renderer/public"),
  base: "./",
  server: {
    port: 3000,
  },
  build: {
    outDir: path.join(__dirname, outDir),
    emptyOutDir: true,
    assetsDir: "assets",
    rollupOptions: {
      input: {
        main: path.join(__dirname, "src/renderer/index.html"),
      },
    },
  },
  ssr: {
    noExternal: ['vite-plugin-static-copy'],
  },
});

export default defineConfig(async ({ mode }) => {
  if (mode === 'web') {
    return createConfig('dist/web');
  }
  return createConfig('dist/renderer');
});

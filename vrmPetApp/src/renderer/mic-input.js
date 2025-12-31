class MicInput {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.silenceTimeout = null;
    this.vadThreshold = 0.01; // Voice activity detection threshold
    this.silenceDuration = 1500; // ms of silence before stopping recording
    
    this.init();
  }
  
  async init() {
    try {
      console.log('[Mic] Requesting microphone permission...');
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        } 
      });
      
      console.log('[Mic] ✓ Microphone access granted');
      
      this.setupVAD(stream);
      this.setupRecorder(stream);
      
      console.log('[Mic] Voice Activity Detection active');
    } catch (error) {
      console.error('[Mic] Initialization error:', error);
      console.error('[Mic] Please grant microphone permissions');
    }
  }
  
  setupVAD(stream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    source.connect(analyser);
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkVolume = () => {
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const volume = average / 255.0;
      
      if (volume > this.vadThreshold) {
        // Voice detected
        if (!this.isRecording) {
          console.log('[Mic] Voice detected, starting recording...');
          this.startRecording();
        }
        
        // Reset silence timeout
        clearTimeout(this.silenceTimeout);
        this.silenceTimeout = setTimeout(() => {
          console.log('[Mic] Silence detected, stopping recording...');
          this.stopRecording();
        }, this.silenceDuration);
      }
      
      requestAnimationFrame(checkVolume);
    };
    
    checkVolume();
    console.log('[Mic] VAD monitoring started');
  }
  
  setupRecorder(stream) {
    // Try to use audio/wav if supported, fallback to webm
    const options = { mimeType: 'audio/webm' };
    
    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (error) {
      console.warn('[Mic] Failed to create MediaRecorder with preferred format:', error);
      this.mediaRecorder = new MediaRecorder(stream);
    }
    
    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };
    
    this.mediaRecorder.onstop = () => {
      if (this.audioChunks.length === 0) {
        console.warn('[Mic] No audio data recorded');
        return;
      }
      
      const audioBlob = new Blob(this.audioChunks, { type: this.mediaRecorder.mimeType });
      this.audioChunks = [];
      
      console.log('[Mic] Recording complete, sending to server (size:', audioBlob.size, 'bytes)');
      window.wsClient?.sendAudio(audioBlob);
    };
    
    this.mediaRecorder.onerror = (error) => {
      console.error('[Mic] MediaRecorder error:', error);
    };
    
    console.log('[Mic] Recorder ready');
  }
  
  startRecording() {
    if (!this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
      try {
        this.audioChunks = [];
        this.mediaRecorder.start();
        this.isRecording = true;
        console.log('[Mic] 🎤 Recording...');
      } catch (error) {
        console.error('[Mic] Start recording error:', error);
      }
    }
  }
  
  stopRecording() {
    if (this.isRecording && this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      try {
        this.mediaRecorder.stop();
        this.isRecording = false;
        console.log('[Mic] ⏹ Recording stopped');
      } catch (error) {
        console.error('[Mic] Stop recording error:', error);
      }
    }
  }
  
  // Manual controls (optional)
  manualStart() {
    console.log('[Mic] Manual start requested');
    this.startRecording();
  }
  
  manualStop() {
    console.log('[Mic] Manual stop requested');
    this.stopRecording();
  }
}

// Initialize
console.log('[Mic] Initializing microphone input');

const micInput = new MicInput();

// Expose globally for other modules and debugging
window.micInput = micInput;

console.log('[Mic] Input exposed to window');
console.log('[Mic] Ready to capture voice');


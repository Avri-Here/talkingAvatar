class AudioHandler {
  constructor() {
    this.currentAudio = null;
    this.audioContext = null;
    this.analyser = null;
    this.lipSyncInterval = null;
  }
  
  async playAudio({ audioBase64, volumes, sliceLength, expressions }) {
    console.log('[Audio] Playing audio, expressions:', expressions);
    
    // Stop previous audio
    this.stop();
    
    const audioDataUrl = `data:audio/wav;base64,${audioBase64}`;
    this.currentAudio = new Audio(audioDataUrl);
    
    // Set expression if provided
    if (expressions && expressions[0] !== undefined) {
      const mappedExpression = this.mapExpression(expressions[0]);
      console.log('[Audio] Setting expression:', expressions[0], '->', mappedExpression);
      
      // Reset other expressions first
      window.vrmRenderer?.resetExpressions();
      
      // Set new expression
      window.vrmRenderer?.setExpression(mappedExpression, 1.0);
    }
    
    // Setup lip sync
    this.setupLipSync(this.currentAudio);
    
    // Play audio
    try {
      await this.currentAudio.play();
      console.log('[Audio] Playback started');
    } catch (error) {
      console.error('[Audio] Play error:', error);
      this.stop();
    }
    
    this.currentAudio.onended = () => {
      console.log('[Audio] Playback ended');
      this.stop();
    };
    
    this.currentAudio.onerror = (error) => {
      console.error('[Audio] Playback error:', error);
      this.stop();
    };
  }
  
  setupLipSync(audio) {
    try {
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaElementSource(audio);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
      
      const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
      
      this.lipSyncInterval = setInterval(() => {
        if (this.analyser) {
          this.analyser.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          const normalizedVolume = average / 255.0;
          
          window.vrmRenderer?.setLipSync(normalizedVolume);
        }
      }, 50); // Update 20 times per second
      
      console.log('[Audio] Lip sync initialized');
    } catch (error) {
      console.error('[Audio] Lip sync setup error:', error);
    }
  }
  
  stop() {
    if (this.lipSyncInterval) {
      clearInterval(this.lipSyncInterval);
      this.lipSyncInterval = null;
    }
    
    window.vrmRenderer?.stopLipSync();
    
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
      this.currentAudio = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close().catch(e => console.error('[Audio] Context close error:', e));
      this.audioContext = null;
      this.analyser = null;
    }
  }
  
  mapExpression(emotion) {
    // Map emotion to VRM expression name
    const emotionMap = {
      'neutral': 'neutral',
      'happy': 'happy',
      'joy': 'happy',
      'smirk': 'happy',
      'angry': 'angry',
      'anger': 'angry',
      'disgust': 'angry',
      'sad': 'sad',
      'sadness': 'sad',
      'fear': 'surprised',
      'surprised': 'surprised',
      'surprise': 'surprised',
      'relaxed': 'relaxed',
      'calm': 'relaxed'
    };
    
    // Handle numeric emotions (from Live2D compatibility)
    if (typeof emotion === 'number') {
      const emotions = ['neutral', 'happy', 'angry', 'sad', 'relaxed', 'surprised'];
      return emotions[emotion] || 'neutral';
    }
    
    // Handle string emotions
    const normalizedEmotion = String(emotion).toLowerCase().trim();
    return emotionMap[normalizedEmotion] || 'neutral';
  }
}

// Initialize
console.log('[Audio] Initializing audio handler');

const audioHandler = new AudioHandler();

// Expose globally for other modules
window.audioHandler = audioHandler;

console.log('[Audio] Handler exposed to window');


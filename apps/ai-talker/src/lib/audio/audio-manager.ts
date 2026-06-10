export class AudioManager {
  private audioContext: AudioContext | null = null;
  public analyser: AnalyserNode | null = null; // Public Access
  private source: AudioBufferSourceNode | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
      this.audioContext = new AudioContextClass();
      
      // Setup Analyser
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
    }
  }

  public unlock() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }

  public async playBlob(blob: Blob): Promise<void> {
    if (!this.audioContext || !this.analyser) return;

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Stop previous if playing
    if (this.source) {
      this.source.disconnect();
    }

    const source = this.audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Route: Source -> Analyser -> Speaker
    source.connect(this.analyser);
    this.analyser.connect(this.audioContext.destination);
    
    source.start(0);
    this.source = source;

    return new Promise((resolve) => {
      source.onended = () => resolve();
    });
  }

  // 現在の音量レベルを取得 (For LipSync)
  public getVolume(): number {
    if (!this.analyser) return 0;
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    // 平均音量を計算
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    return average / 255.0; // 0.0 ~ 1.0 Normalized
  }
}

export const globalAudioManager = new AudioManager();

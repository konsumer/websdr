// this will let you create a AudioWorkletNode with wasm, inline
// export process_samples, get_input_pointer, get_input_size, get_output_pointer, get_output_size

const workletCode = `
class WasmRadioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    // Audio-ready buffer (processed audio samples)
    this.audioRingBuffer = new Float32Array(32768) // Larger audio buffer
    this.audioWriteIndex = 0
    this.audioReadIndex = 0
    this.availableAudio = 0
    
    // Raw radio data buffer (smaller, just for temporary storage)
    this.rawDataBuffer = new Int8Array(262144)
    this.rawWriteIndex = 0
    
    this.wasmReady = false
    
    this.port.onmessage = async (event) => {
      if (event.data.type === 'radioData') {
        try {
          const newData = new Int8Array(event.data.buffer)
          this.processRadioDataImmediately(newData) // Process right away!
        } catch (error) {
          console.error('Error processing radio data:', error)
        }
      }
    }
    
    this.initWasm()
  }

  async initWasm() {
    try {
      const { instance } = await WebAssembly.instantiate(wasmBytes, {})
      this.wasm = instance.exports
      
      if (this.wasm._initialize) {
        this.wasm._initialize()
      }
      if (this.wasm._start) {
        this.wasm._start()
      }
      
      this.inputBufferPtr = this.wasm.get_input_pointer()
      this.inputSize = this.wasm.get_input_size()
      this.outputBufferPtr = this.wasm.get_output_pointer()
      this.outputSize = this.wasm.get_output_size()
      this.expectedSamples = Math.floor(this.outputSize / 4)
      
      this.wasmReady = true
      console.log('WASM radio processor ready', {
        inputSize: this.inputSize,
        outputSize: this.outputSize,
        expectedSamples: this.expectedSamples
      })
    } catch (error) {
      console.error('Failed to initialize WASM:', error)
    }
  }

  processRadioDataImmediately(newData) {
    if (!this.wasmReady) return
    
    // Add new data to raw buffer
    const spaceNeeded = newData.length
    if (spaceNeeded <= this.rawDataBuffer.length) {
      this.rawDataBuffer.set(newData, 0) // Simple overwrite for now
      
      // Process immediately with WASM
      const mem = new Uint8Array(this.wasm.memory.buffer)
      mem.set(newData, this.inputBufferPtr)
      
      // Run FM demodulation
      this.wasm.process_samples(sampleRate, radioSampleRate)
      
      // Get processed audio
      const wasmAudio = new Float32Array(
        this.wasm.memory.buffer, 
        this.outputBufferPtr, 
        this.expectedSamples
      )
      
      // Add processed audio to ring buffer
      this.addAudioToRingBuffer(wasmAudio)
    }
  }

  addAudioToRingBuffer(audioData) {
    const dataLength = audioData.length
    const spaceAvailable = this.audioRingBuffer.length - this.availableAudio
    
    if (dataLength > spaceAvailable) {
      // Make space by advancing read pointer
      const excess = dataLength - spaceAvailable
      this.audioReadIndex = (this.audioReadIndex + excess) % this.audioRingBuffer.length
      this.availableAudio -= excess
    }
    
    // Add audio data
    const spaceToEnd = this.audioRingBuffer.length - this.audioWriteIndex
    
    if (dataLength <= spaceToEnd) {
      this.audioRingBuffer.set(audioData, this.audioWriteIndex)
    } else {
      this.audioRingBuffer.set(audioData.subarray(0, spaceToEnd), this.audioWriteIndex)
      this.audioRingBuffer.set(audioData.subarray(spaceToEnd), 0)
    }
    
    this.audioWriteIndex = (this.audioWriteIndex + dataLength) % this.audioRingBuffer.length
    this.availableAudio += dataLength
  }

  // Super simple process function - just reads from pre-processed audio buffer
  process(inputs, outputs, parameters) {
    const output = outputs[0]
    const outputChannel = output[0]
    const samplesNeeded = outputChannel.length
    
    if (this.availableAudio >= samplesNeeded) {
      // Extract audio from ring buffer
      const spaceToEnd = this.audioRingBuffer.length - this.audioReadIndex
      
      if (samplesNeeded <= spaceToEnd) {
        // No wraparound needed
        for (let i = 0; i < samplesNeeded; i++) {
          outputChannel[i] = this.audioRingBuffer[this.audioReadIndex + i]
        }
      } else {
        // Handle wraparound
        for (let i = 0; i < spaceToEnd; i++) {
          outputChannel[i] = this.audioRingBuffer[this.audioReadIndex + i]
        }
        for (let i = 0; i < samplesNeeded - spaceToEnd; i++) {
          outputChannel[spaceToEnd + i] = this.audioRingBuffer[i]
        }
      }
      
      this.audioReadIndex = (this.audioReadIndex + samplesNeeded) % this.audioRingBuffer.length
      this.availableAudio -= samplesNeeded
    } else {
      // Not enough audio - fill with silence
      outputChannel.fill(0)
    }
    
    return true
  }
}
`

export default async function wasmWorklet(audioContext, name, wasmBytes, radioSampleRate = 2_000_000) {
  const code = `const wasmBytes = new Uint8Array([${new Uint8Array(wasmBytes).join(',')}])\nconst radioSampleRate=${radioSampleRate}\n` + workletCode + `\nregisterProcessor('${name}', WasmRadioProcessor)`
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  await audioContext.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
}

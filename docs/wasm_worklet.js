// this will let you create a AudioWorkletNode with wasm, inline
// export process_samples, get_input_pointer, get_input_size, get_output_pointer, get_output_size

const workletCode = `
class WasmRadioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.wasmReady = false
    this.audioBuffer = null
    this.bufferPosition = 0
    
    this.port.onmessage = async (event) => {
      if (event.data.type === 'radioData') {
        // For now, just ignore radio data while testing sine wave
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
      
      this.outputBufferPtr = this.wasm.get_output_pointer()
      this.outputSize = this.wasm.get_output_size()
      this.expectedSamples = Math.floor(this.outputSize / 4)
      
      this.wasmReady = true
      console.log('WASM radio processor ready', {
        outputSize: this.outputSize,
        expectedSamples: this.expectedSamples
      })
    } catch (error) {
      console.error('Failed to initialize WASM:', error)
    }
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0]
    const outputChannel = output[0]
    const samplesNeeded = outputChannel.length
    
    if (!this.wasmReady) {
      outputChannel.fill(0)
      return true
    }

    // Generate new audio data only when buffer is empty or insufficient
    if (!this.audioBuffer || this.bufferPosition + samplesNeeded > this.audioBuffer.length) {
      this.wasm.process_samples(sampleRate, radioSampleRate)
      
      // Get fresh audio data
      const wasmAudio = new Float32Array(
        this.wasm.memory.buffer, 
        this.outputBufferPtr, 
        this.expectedSamples
      )
      
      // Copy to our buffer to avoid WASM memory issues
      this.audioBuffer = new Float32Array(wasmAudio.length)
      this.audioBuffer.set(wasmAudio)
      this.bufferPosition = 0
    }
    
    // Copy the exact amount needed from our buffer
    for (let i = 0; i < samplesNeeded; i++) {
      outputChannel[i] = this.audioBuffer[this.bufferPosition + i]
    }
    
    // Advance buffer position
    this.bufferPosition += samplesNeeded
    
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

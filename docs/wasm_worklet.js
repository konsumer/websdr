// this will let you create a AudioWorkletNode with wasm, inline
// export process_samples, get_input_pointer, get_input_size, get_output_pointer, get_output_size

const workletCode = `
class WasmRadioProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super()
    this.rawDataBuffer = []
    this.port.onmessage = async (event) => {
      if (event.data.type === 'radioData') {
        const newData = new Uint8Array(event.data.buffer)
        this.rawDataBuffer = Array.from(newData)
        // console.log(this.rawDataBuffer)
      }
    }
    WebAssembly.instantiate(wasmBytes, {}).then(({ instance }) => {
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
    })
  }

  process(inputs, outputs, parameters) {
    if (!this.wasm) {
      console.log('no wasm')
      return true
    }
    const output = outputs[0]
    const outputChannel = output[0]
    if (this.rawDataBuffer.length >= this.inputSize) {
      const inputData = this.rawDataBuffer.splice(0, this.inputSize)
      const mem = new Uint8Array(this.wasm.memory.buffer)
      mem.set(inputData, this.inputBufferPtr)
      this.wasm.process_samples()
      const audioData = new Float32Array(this.wasm.memory.buffer, this.outputBufferPtr, this.expectedSamples)
      const samplesNeeded = outputChannel.length
      const samplesAvailable = Math.min(samplesNeeded, audioData.length)
      for (let i = 0; i < samplesAvailable; i++) {
        outputChannel[i] = audioData[i]
      }
      for (let i = samplesAvailable; i < samplesNeeded; i++) {
        outputChannel[i] = 0
      }
    }
    return true
  }
}
`

export default async function wasmWorklet(audioContext, name, bytes) {
  const code = `const wasmBytes = new Uint8Array([${new Uint8Array(bytes).join(',')}])\n` + workletCode + `\nregisterProcessor('${name}', WasmRadioProcessor)`
  const url = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  await audioContext.audioWorklet.addModule(url)
  URL.revokeObjectURL(url)
}

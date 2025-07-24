import connect from './websdr/websdr.js'
import wasmWorklet from './wasm_worklet.js'

export class RadioFM extends HTMLElement {
  static get observedAttributes() {
    return ['freq']
  }

  constructor() {
    super()
    this.shadow = this.attachShadow({ mode: 'open' })
    const btnConnect = document.createElement('button')
    btnConnect.innerHTML = 'connect'
    this.shadow.appendChild(btnConnect)

    btnConnect.addEventListener('click', async () => {
      this.radio = await connect()
      if (!this.radio.device) {
        console.error('Failed to connect to radio')
        return
      }

      this.freq = Number(this.attributes.freq.value || '0')
      if (this.freq) {
        await this.radio.setFreq(this.freq * 1_000_000)
      }

      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      // register websdr_fm.wasm as fm-wasm AudioWorkletNode
      await wasmWorklet(audioContext, 'fm-wasm', await fetch('websdr_fm.wasm').then((r) => r.arrayBuffer()))
      const fmProcessorNode = new AudioWorkletNode(audioContext, 'fm-wasm')

      fmProcessorNode.connect(audioContext.destination)
      await this.radio.startRx((view) => {
        fmProcessorNode.port.postMessage({
          type: 'radioData',
          buffer: view.buffer
        })
      })
    })
  }

  async attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'freq' && this.radio) {
      this.freq = Number(newValue || '0')
      await this.radio.setFreq(this.freq * 1_000_000)
      console.log('freq set', this.freq)
    }
  }
}

customElements.define('radio-fm', RadioFM)

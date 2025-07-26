// connect and get a USB device that is supported
export default async function connect() {
  const device = await navigator.usb.requestDevice({
    filters: [...HackRF.ids, ...RTLSDR.ids]
  })

  if (!device) {
    throw new Error('No device selected.')
  }

  for (const RadioClass of [RTLSDR, HackRF]) {
    if (RadioClass.ids.find(({ vendorId, productId }) => vendorId === device.vendorId && productId === device.productId)) {
      const r = new RadioClass(device)
      await device.open()
      await device.selectConfiguration(1)
      await device.claimInterface(0)
      await r.setup()
      return r
    }
  }
}

// base-class for radio-drivers
export class Radio {
  constructor(device = null) {
    this.device = device
  }

  // expose as static for await Radio.connect()
  static connect() {
    return connect()
  }

  // EXTEND: setup default things for your radio-device
  async setup() {
    throw new Error('Not Implemented: setup')
  }
}

// this is a port of https://github.com/greatscottgadgets/hackrf/blob/master/host/libhackrf/src/hackrf.c

const TRANSFER_BUFFER_SIZE = 262144

const SAMPLES_PER_BLOCK = 8192
const BYTES_PER_BLOCK = 16384
const MAX_SWEEP_RANGES = 10

const SWEEP_STYLE_LINEAR = 0
const SWEEP_STYLE_INTERLEAVED = 1

const HACKRF_VENDOR_REQUEST_SET_TRANSCEIVER_MODE = 1
const HACKRF_VENDOR_REQUEST_MAX2837_WRITE = 2
const HACKRF_VENDOR_REQUEST_MAX2837_READ = 3
const HACKRF_VENDOR_REQUEST_SI5351C_WRITE = 4
const HACKRF_VENDOR_REQUEST_SI5351C_READ = 5
const HACKRF_VENDOR_REQUEST_SAMPLE_RATE_SET = 6
const HACKRF_VENDOR_REQUEST_BASEBAND_FILTER_BANDWIDTH_SET = 7
const HACKRF_VENDOR_REQUEST_RFFC5071_WRITE = 8
const HACKRF_VENDOR_REQUEST_RFFC5071_READ = 9
const HACKRF_VENDOR_REQUEST_SPIFLASH_ERASE = 10
const HACKRF_VENDOR_REQUEST_SPIFLASH_WRITE = 11
const HACKRF_VENDOR_REQUEST_SPIFLASH_READ = 12
const HACKRF_VENDOR_REQUEST_BOARD_ID_READ = 14
const HACKRF_VENDOR_REQUEST_VERSION_STRING_READ = 15
const HACKRF_VENDOR_REQUEST_SET_FREQ = 16
const HACKRF_VENDOR_REQUEST_AMP_ENABLE = 17
const HACKRF_VENDOR_REQUEST_BOARD_PARTID_SERIALNO_READ = 18
const HACKRF_VENDOR_REQUEST_SET_LNA_GAIN = 19
const HACKRF_VENDOR_REQUEST_SET_VGA_GAIN = 20
const HACKRF_VENDOR_REQUEST_SET_TXVGA_GAIN = 21
const HACKRF_VENDOR_REQUEST_ANTENNA_ENABLE = 23
const HACKRF_VENDOR_REQUEST_SET_FREQ_EXPLICIT = 24
const HACKRF_VENDOR_REQUEST_USB_WCID_VENDOR_REQ = 25
const HACKRF_VENDOR_REQUEST_INIT_SWEEP = 26
const HACKRF_VENDOR_REQUEST_OPERACAKE_GET_BOARDS = 27
const HACKRF_VENDOR_REQUEST_OPERACAKE_SET_PORTS = 28
const HACKRF_VENDOR_REQUEST_SET_HW_SYNC_MODE = 29
const HACKRF_VENDOR_REQUEST_RESET = 30
const HACKRF_VENDOR_REQUEST_OPERACAKE_SET_RANGES = 31
const HACKRF_VENDOR_REQUEST_CLKOUT_ENABLE = 32
const HACKRF_VENDOR_REQUEST_SPIFLASH_STATUS = 33
const HACKRF_VENDOR_REQUEST_SPIFLASH_CLEAR_STATUS = 34
const HACKRF_VENDOR_REQUEST_OPERACAKE_GPIO_TEST = 35
const HACKRF_VENDOR_REQUEST_CPLD_CHECKSUM = 36
const HACKRF_VENDOR_REQUEST_UI_ENABLE = 37
const HACKRF_VENDOR_REQUEST_OPERACAKE_SET_MODE = 38
const HACKRF_VENDOR_REQUEST_OPERACAKE_GET_MODE = 39
const HACKRF_VENDOR_REQUEST_OPERACAKE_SET_DWELL_TIMES = 40
const HACKRF_VENDOR_REQUEST_GET_M0_STATE = 41
const HACKRF_VENDOR_REQUEST_SET_TX_UNDERRUN_LIMIT = 42
const HACKRF_VENDOR_REQUEST_SET_RX_OVERRUN_LIMIT = 43
const HACKRF_VENDOR_REQUEST_GET_CLKIN_STATUS = 44
const HACKRF_VENDOR_REQUEST_BOARD_REV_READ = 45
const HACKRF_VENDOR_REQUEST_SUPPORTED_PLATFORM_READ = 46
const HACKRF_VENDOR_REQUEST_SET_LEDS = 47
const HACKRF_VENDOR_REQUEST_SET_USER_BIAS_T_OPTS = 48

const HACKRF_TRANSCEIVER_MODE_OFF = 0
const HACKRF_TRANSCEIVER_MODE_RECEIVE = 1
const HACKRF_TRANSCEIVER_MODE_TRANSMIT = 2
const HACKRF_TRANSCEIVER_MODE_SS = 3
const TRANSCEIVER_MODE_CPLD_UPDATE = 4
const TRANSCEIVER_MODE_RX_SWEEP = 5

const HACKRF_HW_SYNC_MODE_OFF = 0
const HACKRF_HW_SYNC_MODE_ON = 1

const MAX2837_FT = [1750000, 2500000, 3500000, 5000000, 5500000, 6000000, 7000000, 8000000, 9000000, 10000000, 12000000, 14000000, 15000000, 20000000, 24000000, 28000000]

export class HackRF extends Radio {
  static ids = [
    { vendorId: 0x1d50, productId: 0x604b },
    { vendorId: 0x1d50, productId: 0x6089 },
    { vendorId: 0x1d50, productId: 0xcc15 },
    { vendorId: 0x1fc9, productId: 0x000c }
  ]

  async setup() {
    await this.device.reset()

    // from https://hackrf.readthedocs.io/en/latest/setting_gain.html
    // AMP=0, LNA=16, VGA=16
    await this.setAmpEnable(false)
    await this.setLNAGain(16)
    await this.setVGAGain(16)
    await this.setSampleRate(2_000_000)
  }

  // RF Amplifier Control
  async setAmpEnable(value) {
    const result = await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: HACKRF_VENDOR_REQUEST_AMP_ENABLE,
      value: value ? 1 : 0,
      index: 0
    })
    if (result.status !== 'ok') {
      throw 'failed to setAmpEnable'
    }
  }

  // LNA (Low Noise Amplifier) Gain - RX IF gain 0-40dB, 8dB steps
  async setLNAGain(value) {
    if (value > 40) {
      throw 'gain must be <= 40'
    }
    value &= ~0x07
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_SET_LNA_GAIN,
        value: 0,
        index: value
      },
      1
    )
    if (result.status !== 'ok' || !result.data.getUint8(0)) {
      throw 'failed to setLnaGain'
    }
  }

  // VGA (Variable Gain Amplifier) Gain - RX baseband gain 0-62dB, 2dB steps
  async setVGAGain(value) {
    if (value > 62) {
      throw 'gain must be <= 62'
    }
    value &= ~0x01
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_SET_VGA_GAIN,
        value: 0,
        index: value
      },
      1
    )
    if (result.status !== 'ok' || !result.data.getUint8(0)) {
      throw 'failed to setVgaGain'
    }
  }

  // TX VGA Gain - TX IF gain 0-47dB, 1dB steps
  async setTXVGAGain(value) {
    if (value > 62) {
      throw 'gain must be <= 62'
    }
    value &= ~0x01
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_SET_TXVGA_GAIN,
        value: 0,
        index: value
      },
      1
    )
    if (result.status !== 'ok' || !result.data.getUint8(0)) {
      throw 'failed to setTXVGAGain'
    }
  }

  // Antenna Port Power
  async setAntennaEnable(enabled) {
    const result = await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: HACKRF_VENDOR_REQUEST_ANTENNA_ENABLE,
      value: enabled ? 1 : 0,
      index: 0
    })

    if (result.status !== 'ok') {
      throw `failed to setAntennaEnable`
    }
  }

  // Frequency Setting
  async setFreq(freqHz) {
    const data = new DataView(new ArrayBuffer(8))
    const freqMhz = Math.floor(freqHz / 1e6)
    const freqHz0 = freqHz - freqMhz * 1e6
    data.setUint32(0, freqMhz, true)
    data.setUint32(4, freqHz0, true)
    const result = await this.device.controlTransferOut(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_SET_FREQ,
        value: 0,
        index: 0
      },
      data.buffer
    )
    if (result.status !== 'ok') {
      throw 'failed to setFreq'
    }
  }

  // Sample Rate Configuration
  async setSampleRate(sampleRateHz) {
    const { freq_hz, divider } = this.calculateSampleRateParams(sampleRateHz)
    const data = new Uint8Array(8)
    const view = new DataView(data.buffer)
    view.setUint32(0, freq_hz, true) // little endian
    view.setUint32(4, divider, true) // calculated divider
    const result = await this.device.controlTransferOut(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_SAMPLE_RATE_SET,
        value: 0,
        index: 0
      },
      data
    )
    if (result.status !== 'ok') {
      throw 'setSampleRate failed'
    }

    // Calculate proper baseband filter bandwidth
    const actualSampleRate = freq_hz / divider
    const targetFilterBw = 0.75 * actualSampleRate // anti-aliasing that original C driver applies. sdr++ seems to use factor of 1 (so it's 20, not 15 for 200MHz)
    const selectedFilterBw = this.computeBasebandFilterBandwidth(targetFilterBw)
    await this.setBasebandFilterBandwidth(selectedFilterBw)
  }

  calculateSampleRateParams(targetRate) {
    const MAX_N = 32
    let bestDivider = 1
    let bestFreqHz = Math.round(targetRate)
    let bestError = Math.abs(targetRate - bestFreqHz)

    // Test dividers from 1 to MAX_N
    for (let divider = 1; divider <= MAX_N; divider++) {
      const freq_hz = Math.round(targetRate * divider)
      const actualRate = freq_hz / divider
      const error = Math.abs(targetRate - actualRate)

      if (error < bestError) {
        bestError = error
        bestDivider = divider
        bestFreqHz = freq_hz
      }

      // If we found an exact match, use it
      if (error === 0) break
    }
    return { freq_hz: bestFreqHz, divider: bestDivider }
  }

  computeBasebandFilterBandwidth(bandwidth_hz) {
    let selectedBandwidth = MAX2837_FT[0] // Default to narrowest
    for (const option of MAX2837_FT) {
      if (option <= bandwidth_hz) {
        selectedBandwidth = option
      } else {
        break
      }
    }
    return selectedBandwidth
  }

  // Baseband Filter Bandwidth
  async setBasebandFilterBandwidth(bandwidthHz) {
    const result = await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: HACKRF_VENDOR_REQUEST_BASEBAND_FILTER_BANDWIDTH_SET,
      value: bandwidthHz & 0xffff, // Lower 16 bits
      index: (bandwidthHz >> 16) & 0xffff // Upper 16 bits
    })

    if (result.status !== 'ok') {
      throw 'setBasebandFilterBandwidth failed'
    }
  }

  // Get Board ID - Uses controlTransferIn since it reads data
  async getBoardId() {
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_BOARD_ID_READ,
        value: 0,
        index: 0
      },
      1
    )

    if (result.status !== 'ok') {
      throw 'getBoardId failed'
    }

    return result.data.getUint8(0)
  }

  // Get Version String
  async getVersionString() {
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_VERSION_STRING_READ,
        value: 0,
        index: 0
      },
      255
    )

    if (result.status !== 'ok') {
      throw 'getVersionString failed'
    }
    return new TextDecoder().decode(result.data)
  }

  // Get Part ID and Serial Number
  async getPartIdSerialNo() {
    const result = await this.device.controlTransferIn(
      {
        requestType: 'vendor',
        recipient: 'device',
        request: HACKRF_VENDOR_REQUEST_BOARD_PARTID_SERIALNO_READ,
        value: 0,
        index: 0
      },
      24
    ) // 2*4 + 4*4 = 24 bytes

    if (result.status !== 'ok') {
      throw 'getPartIdSerialNo failed'
    }

    return {
      partId: [result.data.getUint32(0, true), result.data.getUint32(4, true)],
      serialNo: [result.data.getUint32(8, true), result.data.getUint32(12, true), result.data.getUint32(16, true), result.data.getUint32(20, true)]
    }
  }

  // set the ranceiver mode
  async setDeviceTransceiverMode(mode = HACKRF_TRANSCEIVER_MODE_RECEIVE) {
    const result = await this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'device',
      request: HACKRF_VENDOR_REQUEST_SET_TRANSCEIVER_MODE,
      value: mode,
      index: 0
    })

    if (result.status !== 'ok') {
      throw 'setDeviceTransceiverMode failed'
    }
  }

  // listen for data and fire callback
  async startRx(callback) {
    await this.setDeviceTransceiverMode(HACKRF_TRANSCEIVER_MODE_RECEIVE)
    const transfer = async () => {
      const result = await this.device.transferIn(1, TRANSFER_BUFFER_SIZE)
      if (result) {
        callback(result.data)
      }
      await transfer()
    }
    await transfer()
  }
}

export class RTLSDR extends Radio {
  static ids = [
    { vendorId: 0x0bda, productId: 0x2832 },
    { vendorId: 0x0bda, productId: 0x2838 }
  ]
}

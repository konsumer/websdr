import { useRef, useEffect, useState } from 'react'
import FFT from 'fft.js'
import { useRadio } from './radio.jsx'
import * as themes from './themes'

function hannWindow(N) {
  return Array.from({ length: N }, (_, n) => 0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1))))
}

function fftShift(array) {
  const N = array.length
  const shifted = new Float32Array(N)
  const half = Math.floor(N / 2)

  for (let i = 0; i < half; i++) {
    shifted[i] = array[i + half]
  }
  for (let i = 0; i < half; i++) {
    shifted[i + half] = array[i]
  }

  return shifted
}

export default function Spectrogram({
  fftSize = 1024,
  waterfallHeight = 400,
  dynamicRange = 80,
  referenceLevel = -10, // Changed from -20 to -10 for darker display
  showCenterLine = true,
  centerLineColor = 'rgba(0, 0, 0, 0.5)',
  theme = 'viridis' // 'viridis', 'heat', 'heatDark', 'plasma', 'turbo'
}) {
  const canvasRef = useRef()
  const { radio } = useRadio()
  const [debugInfo, setDebugInfo] = useState({
    frameCount: 0,
    avgI: 0,
    avgQ: 0,
    minI: 0,
    maxI: 0,
    minQ: 0,
    maxQ: 0,
    dcPower: 0,
    totalPower: 0
  })

  useEffect(() => {
    if (!radio || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = fftSize
    canvas.height = waterfallHeight

    const fft = new FFT(fftSize)
    const fftInput = new Float32Array(fftSize * 2)
    const fftOutput = new Float32Array(fftSize * 2)
    const window = hannWindow(fftSize)

    let iqBuffer = new Int8Array(0)
    let frameCount = 0

    // DC removal filter state
    let dcI = 0
    let dcQ = 0
    const dcAlpha = 0.999

    // Select colormap function
    const colormapFn = themes[theme] || themes.viridis

    radio.startRx((b) => {
      const newData = new Int8Array(b.buffer)
      const combined = new Int8Array(iqBuffer.length + newData.length)
      combined.set(iqBuffer)
      combined.set(newData, iqBuffer.length)
      iqBuffer = combined

      while (iqBuffer.length >= fftSize * 2) {
        const frame = iqBuffer.slice(0, fftSize * 2)
        iqBuffer = iqBuffer.slice(fftSize * 2)
        frameCount++

        // Debug: analyze raw data
        let sumI = 0,
          sumQ = 0
        let minI = 127,
          maxI = -128
        let minQ = 127,
          maxQ = -128

        for (let i = 0; i < fftSize; i++) {
          const I = frame[2 * i]
          const Q = frame[2 * i + 1]
          sumI += I
          sumQ += Q
          if (I < minI) minI = I
          if (I > maxI) maxI = I
          if (Q < minQ) minQ = Q
          if (Q > maxQ) maxQ = Q
        }

        // Update debug info every 10 frames
        if (frameCount % 10 === 0) {
          setDebugInfo({
            frameCount,
            avgI: (sumI / fftSize).toFixed(2),
            avgQ: (sumQ / fftSize).toFixed(2),
            minI,
            maxI,
            minQ,
            maxQ,
            dcPower: dcI.toFixed(4),
            totalPower: 0
          })
        }

        // Process with DC removal
        for (let i = 0; i < fftSize; i++) {
          // Convert to float and remove DC
          let I = frame[2 * i] / 128.0
          let Q = frame[2 * i + 1] / 128.0

          // Update DC estimate
          dcI = dcAlpha * dcI + (1 - dcAlpha) * I
          dcQ = dcAlpha * dcQ + (1 - dcAlpha) * Q

          // Remove DC and apply window
          I = (I - dcI) * window[i]
          Q = (Q - dcQ) * window[i]

          fftInput[2 * i] = I
          fftInput[2 * i + 1] = Q
        }

        // Perform FFT
        fft.transform(fftOutput, fftInput)

        // Calculate power spectrum in dB
        const powerSpectrum = new Float32Array(fftSize)
        let totalPower = 0

        for (let i = 0; i < fftSize; i++) {
          const re = fftOutput[2 * i]
          const im = fftOutput[2 * i + 1]
          const power = re * re + im * im
          totalPower += power
          powerSpectrum[i] = 10 * Math.log10(power + 1e-10)
        }

        // Update debug info with total power
        if (frameCount % 10 === 0) {
          setDebugInfo((prev) => ({ ...prev, totalPower: totalPower.toFixed(2) }))
        }

        // Apply FFT shift
        const shiftedPower = fftShift(powerSpectrum)

        // Scroll waterfall
        const imageData = ctx.getImageData(0, 0, fftSize, waterfallHeight - 1)
        ctx.putImageData(imageData, 0, 1)

        // Draw new line with auto-scaling
        const minDb = referenceLevel - dynamicRange
        const maxDb = referenceLevel

        for (let x = 0; x < fftSize; x++) {
          const db = shiftedPower[x]
          const normalized = (db - minDb) / (maxDb - minDb)
          ctx.fillStyle = colormapFn(normalized)
          ctx.fillRect(x, 0, 1, 1)
        }

        // Draw center frequency marker
        if (showCenterLine) {
          const centerX = Math.floor(fftSize / 2)
          ctx.fillStyle = centerLineColor
          ctx.fillRect(centerX, 0, 1, waterfallHeight)
        }
      }
    })

    return () => {
      if (radio && radio.stopRx) radio.stopRx()
    }
  }, [radio, fftSize, waterfallHeight, dynamicRange, referenceLevel, showCenterLine, centerLineColor, theme])

  if (!radio) return null

  return (
    <div style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: waterfallHeight,
          background: '#000',
          display: 'block',
          imageRendering: 'pixelated'
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          color: 'white',
          background: 'rgba(0,0,0,0.7)',
          padding: '10px',
          borderRadius: 4,
          fontSize: 11,
          fontFamily: 'monospace'
        }}
      >
        <div>Frame: {debugInfo.frameCount}</div>
        <div>
          I: avg={debugInfo.avgI} [{debugInfo.minI}, {debugInfo.maxI}]
        </div>
        <div>
          Q: avg={debugInfo.avgQ} [{debugInfo.minQ}, {debugInfo.maxQ}]
        </div>
        <div>DC: {debugInfo.dcPower}</div>
        <div>Power: {debugInfo.totalPower}</div>
        <div>
          FFT: {fftSize} | Range: {dynamicRange}dB
        </div>
      </div>
    </div>
  )
}

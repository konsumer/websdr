import { useState, useCallback, useEffect } from 'react'
import { useRadio } from './radio.jsx'

export default function SliderFreqFM({ defaultValue }) {
  const { radio } = useRadio()
  const [val, valSet] = useState(defaultValue)

  const handleChange = useCallback(async (e) => {
    valSet(e.target.value)
    if (radio) {
      radio.setFreq(Number(e.target.value) * 1_000_000)
    }
  })

  useEffect(() => {
    valSet(defaultValue)
    if (radio) {
      radio.setFreq(Number(defaultValue) * 1_000_000)
    }
  }, [defaultValue, radio])

  if (!radio) {
    return null
  }

  return (
    <div className='flex flex-row gap-2'>
      <input className='grow' type='range' min={1} max={1000} step={0.1} value={val} onChange={handleChange} />
      <div>{Number(val).toFixed(1)}</div>
    </div>
  )
}

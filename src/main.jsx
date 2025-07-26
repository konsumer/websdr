import { createRoot } from 'react-dom/client'
import './index.css'
import { RadioProvider, useRadio } from './radio'
import Spectrogram from './Spectrogram'
import SliderFreqFM from './SliderFreqFM'

function ConnectorWidget() {
  const { radio, info, connect } = useRadio()

  if (radio) {
    return (
      <div>
        Connected to {info.type} ({info.version})
      </div>
    )
  }

  return (
    <button className='btn' onClick={connect}>
      connect
    </button>
  )
}

createRoot(document.getElementById('root')).render(
  <RadioProvider>
    <div className='p-4 flex flex-col gap-2'>
      <ConnectorWidget />
      <Spectrogram theme='plasma' />
      <SliderFreqFM defaultValue={90.7} />
    </div>
  </RadioProvider>
)

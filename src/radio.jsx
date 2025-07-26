// this exports context for radio

import { createContext, useContext, useState, useCallback } from 'react'
import connect from './websdr.js'

export const context = createContext()
const Provider = context.Provider

export const useRadio = () => useContext(context)

export function RadioProvider({ children }) {
  const [radio, radioSet] = useState()
  const [info, infoSet] = useState()

  const doConnect = useCallback(async () => {
    const r = await connect()

    const i = {
      id: await r.getBoardId(),
      version: await r.getVersionString(),
      ...(await r.getPartIdSerialNo()),
      type: r.constructor.name
    }
    infoSet(i)
    radioSet(r)
  })

  return <Provider value={{ connect: doConnect, radio, info }}>{children}</Provider>
}

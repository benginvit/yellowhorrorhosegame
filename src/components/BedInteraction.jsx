import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { nearBed } from '../levels/astridLayout'

/**
 * Renders nothing. Reports whether the player is within reach of the bed's foot end (`onNear`, only when it changes) and
 * calls `onToggle` on the F key. The mobile button in MobileControls calls the same App handler. While `hiding` the camera
 * lies under the bed and the player counts as near, so the "crawl out" prompt stays up.
 */
function BedInteraction({ hiding, onNear, onToggle }) {
  const camera = useThree((s) => s.camera)
  const last = useRef(undefined)

  useFrame(() => {
    const near = hiding || nearBed(camera.position.x, camera.position.z)
    if (near !== last.current) {
      last.current = near
      onNear(near)
    }
  })

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'KeyF' && !e.repeat) onToggle()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onToggle])

  return null
}

export default BedInteraction

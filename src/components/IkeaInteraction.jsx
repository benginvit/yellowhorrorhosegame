import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { nearestInteractable } from '../levels/ikeaLayout'

/**
 * Renders nothing. Reports which interactable is in reach (`onNear`: nearestInteractable of the camera position, only when
 * it changes, independent of the game state; App decides whether it is usable, see validInteractTarget) and calls
 * `onInteract` on the F key. The "Use" button in MobileControls calls the same App handler.
 */
function IkeaInteraction({ onNear, onInteract }) {
  const camera = useThree((s) => s.camera)
  const last = useRef(undefined)

  useFrame(() => {
    const near = nearestInteractable(camera.position.x, camera.position.z)
    if (near !== last.current) {
      last.current = near
      onNear(near)
    }
  })

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'KeyF' && !e.repeat) onInteract()
    }
    window.addEventListener('keydown', down)
    return () => window.removeEventListener('keydown', down)
  }, [onInteract])

  return null
}

export default IkeaInteraction

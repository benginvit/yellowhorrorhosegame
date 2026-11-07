import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { TRAY_POS, RASMUS_TABLE_POS, DRINK_STATION_POS, INTERACT_RANGE } from '../levels/ikeaLayout'

/**
 * Which interactable is within reach of the player, for the F key and the "Use" button. Pure function of the game
 * state and the player's horizontal position (the closest eligible target wins):
 *  - 'tray'         ikeaPhase 'serve', nothing carried;
 *  - 'table'        'serve' with the tray in hand AND Rasmus seated (serving is blocked until he sits), or
 *                   'deliverDrink' with the glass in hand;
 *  - 'drinkStation' ikeaPhase 'drink'.
 *
 * @param {{ ikeaPhase: string|null, ikeaCarrying: null|'tray'|'drink', ikeaRasmusSeated: boolean }} state
 * @param {number} x  player world x
 * @param {number} z  player world z
 * @returns {null|'tray'|'table'|'drinkStation'}
 */
export function findInteractTarget({ ikeaPhase, ikeaCarrying, ikeaRasmusSeated }, x, z) {
  const candidates = []
  if (ikeaPhase === 'serve' && ikeaCarrying === null) candidates.push(['tray', TRAY_POS])
  if ((ikeaPhase === 'serve' && ikeaCarrying === 'tray' && ikeaRasmusSeated) || (ikeaPhase === 'deliverDrink' && ikeaCarrying === 'drink')) {
    candidates.push(['table', RASMUS_TABLE_POS])
  }
  if (ikeaPhase === 'drink') candidates.push(['drinkStation', DRINK_STATION_POS])
  let best = null
  let bestDist = INTERACT_RANGE
  for (const [id, pos] of candidates) {
    const d = Math.hypot(pos[0] - x, pos[2] - z)
    if (d <= bestDist) {
      best = id
      bestDist = d
    }
  }
  return best
}

/**
 * Renders nothing. Reports the target in reach to App (`onTarget`, only when it changes) and calls `onInteract` on the F key.
 * The "Use" button in MobileControls calls the same App handler.
 */
function IkeaInteraction({ gameState, onTarget, onInteract }) {
  const camera = useThree((s) => s.camera)
  const last = useRef(null)
  const state = useRef(gameState)
  state.current = gameState

  useFrame(() => {
    const target = findInteractTarget(state.current, camera.position.x, camera.position.z)
    if (target !== last.current) {
      last.current = target
      onTarget(target)
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

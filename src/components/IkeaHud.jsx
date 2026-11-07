import { useEffect, useRef } from 'react'
import { IS_FROZEN } from '../testMode'
import { playHeartbeatSound } from '../utils/sounds'

const BPM_START = 60
const BPM_END = 160
const SHAKE_SECONDS = 5

/** Heartbeat tempo for a stress progress in 0..1 (0 = order just started, 1 = Rasmus arrives). */
export const heartbeatBpm = (progress) => BPM_START + (BPM_END - BPM_START) * Math.min(1, Math.max(0, progress))

/**
 * Stress effects while ordering, growing with progress (1 - ikeaTimeLeft / IKEA_ORDER_SECONDS): heartbeat sound
 * (60 -> 160 bpm), a red vignette that pulses with the beat and a light screen shake the last ~5 s.
 *
 * Photosensitivity (BENG-11): the vignette is a smooth opacity pulse (low -> high within the beat, at most ~2.7 Hz at
 * 160 bpm, with a small amplitude), the shake is a few px of canvas movement without any luminance change, and it is off
 * with prefers-reduced-motion. In a frozen test build there is no sound, no pulse and no shake: the vignette is a
 * static function of progress, so the frame is deterministic.
 *
 * @param {object} props
 * @param {boolean} props.active  ikeaPhase === 'ordering'
 * @param {number} props.progress  0..1
 * @param {number} props.timeLeft  seconds left
 */
function IkeaHud({ active, progress, timeLeft }) {
  const progressRef = useRef(progress)
  progressRef.current = progress
  const shaking = active && !IS_FROZEN && timeLeft <= SHAKE_SECONDS

  // Heartbeat: re-armed after each beat so the tempo follows the progress.
  useEffect(() => {
    if (!active || IS_FROZEN) return undefined
    let id
    const beat = () => {
      try { playHeartbeatSound() } catch (e) { /* audio blocked: the visuals still work */ }
      id = setTimeout(beat, 60000 / heartbeatBpm(progressRef.current))
    }
    beat()
    return () => clearTimeout(id)
  }, [active])

  useEffect(() => {
    if (!shaking) return undefined
    document.body.classList.add('ikea-shake')
    return () => document.body.classList.remove('ikea-shake')
  }, [shaking])

  if (!active) return null
  const base = 0.15 + 0.4 * progress
  const style = {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    background: 'radial-gradient(ellipse at center, rgba(120,0,0,0) 45%, rgba(150,0,0,0.9) 100%)',
    '--ikea-vignette-low': base,
    '--ikea-vignette-high': Math.min(1, base + 0.2),
    opacity: base,
    ...(IS_FROZEN ? null : { animation: `ikeaVignettePulse ${60 / heartbeatBpm(progress)}s ease-in-out infinite` }),
  }
  return <div data-testid="ikea-vignette" style={style} />
}

export default IkeaHud

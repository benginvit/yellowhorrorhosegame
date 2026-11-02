import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PARTICLES_ANIMATE, SoftPointsMaterial, createRand, particleCount, updatePointScale, wrap } from './common'

// Outdoor air (BENG-28): slowly falling ash/spores that drift in the wind, plus a few
// large, very faint fog puffs near the ground that thicken the fogExp2. Two THREE.Points,
// one draw call each, positions updated in useFrame with delta. Both volumes follow the
// camera: a particle that leaves the box re-enters on the opposite side (wrap), so the
// air is always populated around the player without ever spawning anything.
// Colours are desaturated with a faint yellow tone to sit in the HORROR_FX grading, and
// stay well under the bloom threshold (sRGB luma ~0.5 at full alpha).

export const ASH = {
  count: 600, // desktop; mobile (pointer: coarse) gets half, see particleCount()
  box: [36, 9, 36], // metres around the camera (x, y, z)
  floor: 0.1, // bottom of the volume (y)
  fall: [0.12, 0.4], // m/s downwards, per particle
  wind: [0.3, 0.1], // m/s steady drift (x, z)
  swirl: 0.3, // m/s wobble amplitude
  swirlFreq: [0.4, 1.3], // rad/s wobble frequency, per particle
  size: [0.05, 0.11], // sprite diameter, metres
  color: '#c8bfa0',
  opacity: 0.6,
  nearFade: [0.4, 1.5],
  groundFade: [0, 0.1],
  stream: 0x61736820, // 'ash '
}

export const GROUND_FOG = {
  count: 24,
  box: [50, 0.8, 50],
  floor: 0.2,
  fall: [0, 0],
  wind: [0.25, 0.08],
  swirl: 0.15,
  swirlFreq: [0.1, 0.3],
  size: [3, 6],
  color: '#7a7768',
  opacity: 0.28,
  nearFade: [3, 10],
  groundFade: [0, 1.2],
  stream: 0x666f6720, // 'fog '
}

const MAX_DELTA = 0.1 // s; a long stall must not teleport the particles

/** Seeded start layout + per-particle speeds. The layout is centred on the origin and wrapped around the camera on the first frame. */
function makeParticles(cfg) {
  const count = particleCount(cfg.count)
  const rand = createRand(cfg.stream)
  const lerp = ([a, b]) => a + (b - a) * rand()
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  const fall = new Float32Array(count)
  const freq = new Float32Array(count)
  const phase = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (rand() - 0.5) * cfg.box[0]
    positions[i * 3 + 1] = cfg.floor + rand() * cfg.box[1]
    positions[i * 3 + 2] = (rand() - 0.5) * cfg.box[2]
    sizes[i] = lerp(cfg.size)
    seeds[i] = rand()
    fall[i] = lerp(cfg.fall)
    freq[i] = lerp(cfg.swirlFreq)
    phase[i] = rand() * Math.PI * 2
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return { count, geometry, positions, fall, freq, phase }
}

function ParticleField({ cfg }) {
  const { camera, gl } = useThree()
  const data = useMemo(() => makeParticles(cfg), [cfg])
  const material = useMemo(
    () => new SoftPointsMaterial({ color: cfg.color, opacity: cfg.opacity, nearFade: cfg.nearFade, groundFade: cfg.groundFade }),
    [cfg],
  )

  useFrame((state, delta) => {
    const { count, positions, fall, freq, phase } = data
    const dt = PARTICLES_ANIMATE ? Math.min(delta, MAX_DELTA) : 0
    const t = state.clock.elapsedTime
    const [hx, height, hz] = [cfg.box[0] / 2, cfg.box[1], cfg.box[2] / 2]
    const cx = camera.position.x
    const cz = camera.position.z
    for (let i = 0; i < count; i++) {
      const j = i * 3
      let x = positions[j]
      let y = positions[j + 1]
      let z = positions[j + 2]
      if (dt > 0) {
        const w = t * freq[i] + phase[i]
        x += (cfg.wind[0] + cfg.swirl * Math.sin(w)) * dt
        z += (cfg.wind[1] + cfg.swirl * Math.cos(w * 0.7)) * dt
        y -= fall[i] * dt
      }
      // Keep the volume around the camera (toroidal wrap on all three axes).
      positions[j] = cx + wrap(x - cx, hx)
      positions[j + 1] = cfg.floor + wrap(y - cfg.floor - height / 2, height / 2) + height / 2
      positions[j + 2] = cz + wrap(z - cz, hz)
    }
    data.geometry.attributes.position.needsUpdate = true
    updatePointScale(material, gl, camera)
  })

  return <points geometry={data.geometry} material={material} frustumCulled={false} />
}

/** Outdoor exterior only (Ground/House). Mount only when PARTICLES_ENABLED (see Game.jsx). */
export default function Ash() {
  return (
    <>
      <ParticleField cfg={ASH} />
      <ParticleField cfg={GROUND_FOG} />
    </>
  )
}

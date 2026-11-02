import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { SoftPointsMaterial, createRand, particleCount, updatePointScale } from './common'
import { onSoundEvent } from '../../utils/sounds'

// Event bursts (BENG-29): short puffs of particles on the existing sound events
// ('hit', 'jumpscare' from utils/sounds.js, 'astrid' = Astrid wakes, emitted from App).
// One THREE.Points per kind (one draw call each) with a small fixed pool that is respawned
// on every event; nothing is created at runtime. A burst is spawned in world space a
// short way in front of the camera, flies outwards with drag and fades out within
// `duration` seconds, then the Points is hidden (no draw call). No full-screen flashes:
// small, low-alpha sprites in a ~1 m cloud. A burst can start `delay` seconds after its
// event, when the full-screen overlay of the same event (Jumpscare, Astrid wakes) is gone. All randomness comes from createRand, motion
// is a function of the clock, so a frozen test clock gives identical frames.

export const BURSTS = {
  hit: {
    name: 'burstHit', // dust knocked loose by the hit
    count: 32,
    color: '#b9ad90',
    opacity: 0.45,
    size: [0.05, 0.1],
    duration: 0.9,
    distance: 1.6,
    spread: 0.45,
    speed: [0.3, 1.0],
    drag: 2.5,
    gravity: -0.25,
    stream: 0x62686974, // 'bhit'
  },
  jumpscare: {
    name: 'burstJumpscare', // dark specks
    count: 40,
    color: '#1c1612',
    opacity: 0.5,
    size: [0.04, 0.09],
    duration: 0.6,
    delay: 0.8, // the full-screen Jumpscare overlay (0.8 s) covers the scene until then
    distance: 1.4,
    spread: 0.5,
    speed: [0.8, 2.2],
    drag: 3,
    gravity: 0,
    stream: 0x626a7363, // 'bjsc'
  },
  astrid: {
    name: 'burstAstrid', // faint puff of dust
    count: 24,
    color: '#d8d0b8',
    opacity: 0.22,
    size: [0.1, 0.2],
    duration: 1,
    distance: 2,
    spread: 0.6,
    speed: [0.1, 0.4],
    drag: 1.5,
    gravity: 0.05,
    stream: 0x62617374, // 'bast'
  },
}

const ATTACK = 0.08 // s to full alpha
const MAX_DELTA = 0.1 // s; a long stall must not skip the whole burst

const fwd = new THREE.Vector3()

function makePool(cfg) {
  const count = particleCount(cfg.count)
  const rand = createRand(cfg.stream)
  const positions = new Float32Array(count * 3)
  const sizes = new Float32Array(count)
  const seeds = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    sizes[i] = cfg.size[0] + (cfg.size[1] - cfg.size[0]) * rand()
    seeds[i] = rand()
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
  return { count, rand, geometry, positions, origin: new Float32Array(count * 3), vel: new Float32Array(count * 3) }
}

function Burst({ type }) {
  const cfg = BURSTS[type]
  const { camera, gl } = useThree()
  const pool = useMemo(() => makePool(cfg), [cfg])
  const material = useMemo(
    () => new SoftPointsMaterial({ color: cfg.color, opacity: 0, nearFade: [0.4, 1], groundFade: [-1, 0] }),
    [cfg],
  )
  const points = useRef()
  const state = useRef({ pending: false, wait: Infinity, age: Infinity })

  useEffect(() => {
    const unsubscribe = onSoundEvent((t) => {
      if (t === type) state.current.pending = true
    })
    return () => {
      unsubscribe()
      pool.geometry.dispose()
      material.dispose()
    }
  }, [type, pool, material])

  useFrame((s, delta) => {
    const st = state.current
    const obj = points.current
    if (!obj) return
    const dt = Math.min(delta, MAX_DELTA)
    if (st.pending) {
      st.pending = false
      st.wait = cfg.delay ?? 0
      st.age = Infinity
    }
    if (st.wait !== Infinity && st.wait <= 0) {
      st.wait = Infinity
      st.age = 0
      camera.getWorldDirection(fwd)
      const { rand, origin, vel, positions, count } = pool
      const cx = camera.position.x + fwd.x * cfg.distance
      const cy = camera.position.y + fwd.y * cfg.distance - 0.2
      const cz = camera.position.z + fwd.z * cfg.distance
      for (let i = 0; i < count; i++) {
        // Random direction on a sphere; same direction scaled for the start offset and the velocity.
        const u = rand() * 2 - 1
        const a = rand() * Math.PI * 2
        const r = Math.sqrt(1 - u * u)
        const dx = r * Math.cos(a)
        const dy = u
        const dz = r * Math.sin(a)
        const off = cfg.spread * rand()
        const sp = cfg.speed[0] + (cfg.speed[1] - cfg.speed[0]) * rand()
        origin[i * 3] = cx + dx * off
        origin[i * 3 + 1] = Math.max(0.05, cy + dy * off)
        origin[i * 3 + 2] = cz + dz * off
        vel[i * 3] = dx * sp
        vel[i * 3 + 1] = dy * sp
        vel[i * 3 + 2] = dz * sp
      }
    } else if (st.wait !== Infinity) {
      st.wait -= dt
    } else if (st.age !== Infinity) {
      st.age += dt
    }
    const age = st.age
    const active = age < cfg.duration
    obj.visible = active
    if (!active) return
    const { origin, vel, positions, count } = pool
    // Integral of v * exp(-drag * t): drag slows the burst down, gravity pulls it (or lifts it).
    const travel = (1 - Math.exp(-cfg.drag * age)) / cfg.drag
    const g = 0.5 * cfg.gravity * age * age
    for (let i = 0; i < count; i++) {
      positions[i * 3] = origin[i * 3] + vel[i * 3] * travel
      positions[i * 3 + 1] = Math.max(0.05, origin[i * 3 + 1] + vel[i * 3 + 1] * travel + g)
      positions[i * 3 + 2] = origin[i * 3 + 2] + vel[i * 3 + 2] * travel
    }
    pool.geometry.attributes.position.needsUpdate = true
    const k = age / cfg.duration
    material.uniforms.uOpacity.value = cfg.opacity * Math.min(1, age / ATTACK) * (1 - k) * (1 - k)
    updatePointScale(material, gl, camera)
  })

  return <points ref={points} name={cfg.name} geometry={pool.geometry} material={material} renderOrder={7} frustumCulled={false} visible={false} />
}

export default function Bursts() {
  return (
    <>
      <Burst type="hit" />
      <Burst type="jumpscare" />
      <Burst type="astrid" />
    </>
  )
}

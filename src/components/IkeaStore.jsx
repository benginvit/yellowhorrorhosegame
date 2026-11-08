import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Text } from '@react-three/drei'
import {
  KIOSK_POS, KIOSK_SIZE, KIOSK_FACING, TRAY_POS, ASTRID_POS, KNIFE_SHELF_POS, IKEA_ROOM, IKEA_TABLES, IKEA_CHAIRS, TABLE_DEPTH, TABLE_HEIGHT,
  CHAIR_SIZE, COUNTER, TRAY_RACK, KITCHEN_UNITS, KITCHEN_ISLANDS, KNIFE_SHELF,
} from '../levels/ikeaLayout'

// Room bounds (world units). Floor y = 0. The player starts at z = 3 and the kitchen
// department is at the far (-x, -z) end. These corridors must stay free of tables, chairs and racks:
//  - RASMUS_PATH and the intro camera line of sight: x -17..-15 / z -14..-4, the diagonal (-9, -9) -> (-4, -4) ->
//    (-2.05, -0.5), the strip x = -2.05 / z -0.5..1.9 (between the tray rack, x <= -2.5, and the counter, x >= -1.6)
//    and z = 1.9 / x -2.05..-0.9 in front of the counter (counter front at z 1.35);
//  - Rasmus' walk to his seat (Rasmus.jsx SEAT_APPROACH): (-0.9, 1.9) -> (1.8, 2.0) -> RASMUS_SEAT_POS, past the
//    counter's right end (x 1.6) and in front of Astrid (z 3);
//  - the player's routes tray -> table -> drink station: (0, 2.2) -> (4.25, 2.4) -> (-3, 5.2). The nearest furniture is
//    the chair at (3.4, 2.0) of Rasmus' own table and the table at (5, 6), both > 0.4 clear of the lines.
// Restaurant tables stand at x = 5 and 9 (z <= -1 and z = 6) and the drink station alone at (-3, 6): the area
// x -2..3 / z 1.8..6 between the counter, the tables and the station is open floor.
const { minX: X_MIN, maxX: X_MAX, minZ: Z_MIN, maxZ: Z_MAX } = IKEA_ROOM
const CEILING_Y = 4.5

const BLUE = '#0058a3'
const YELLOW = '#ffda1a'
const WOOD = '#c9a26b'
const STEEL = '#aab0b8'

function box(w, h, d, x, y, z) {
  const g = new THREE.BoxGeometry(w, h, d)
  g.translate(x, y, z)
  return g
}

// Chairs and tables are merged into one geometry each and drawn instanced:
// ~60 pieces of furniture cost 2 draw calls.
function makeChairGeometry() {
  const parts = [box(CHAIR_SIZE, 0.06, CHAIR_SIZE, 0, 0.46, 0), box(CHAIR_SIZE, 0.5, 0.06, 0, 0.74, -0.22)]
  for (const sx of [-0.21, 0.21]) for (const sz of [-0.21, 0.21]) parts.push(box(0.05, 0.43, 0.05, sx, 0.215, sz))
  return mergeGeometries(parts)
}

function makeTableGeometry(length) {
  const parts = [box(length, 0.06, TABLE_DEPTH, 0, TABLE_HEIGHT, 0)]
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.push(box(0.07, 0.72, 0.07, sx * (length / 2 - 0.1), 0.36, sz * 0.35))
  return mergeGeometries(parts)
}

function Instanced({ geometry, placements, color, castShadow = false }) {
  const ref = useRef()
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3(1, 1, 1)
    placements.forEach(([x, z, rotY], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY)
      m.compose(new THREE.Vector3(x, 0, z), q, s)
      ref.current.setMatrixAt(i, m)
    })
    ref.current.instanceMatrix.needsUpdate = true
    ref.current.computeBoundingSphere()
  }, [placements])
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, placements.length]} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial color={color} />
    </instancedMesh>
  )
}

// Tables run along z (hence the quarter turn); the table and chair spots come from ikeaLayout.js, like the collision boxes.
const TABLE_LENGTHS = [...new Set(IKEA_TABLES.map((t) => t.length))]
const TABLES_BY_LENGTH = TABLE_LENGTHS.map((length) => ({
  length,
  placements: IKEA_TABLES.filter((t) => t.length === length).map(({ x, z }) => [x, z, Math.PI / 2]),
}))

function Sign({ position, rotation = [0, 0, 0], width, height = 0.7, text, bg = BLUE, fg = YELLOW, size = 0.4 }) {
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[width, height, 0.08]} />
        <meshStandardMaterial color={bg} emissive={bg} emissiveIntensity={0.25} />
      </mesh>
      <Text position={[0, 0, 0.05]} fontSize={size} color={fg} anchorX="center" anchorY="middle">
        {text}
      </Text>
    </group>
  )
}

function Kiosk() {
  const [w, h] = KIOSK_SIZE
  return (
    <group
      position={[KIOSK_POS[0], KIOSK_POS[1], KIOSK_POS[2]]}
      rotation={[0, Math.atan2(KIOSK_FACING[0], KIOSK_FACING[2]), 0]}
    >
      <mesh position={[0, 0.05, 0]} castShadow>
        <boxGeometry args={[w * 0.7, 0.1, KIOSK_SIZE[2] * 0.8]} />
        <meshStandardMaterial color="#222a33" />
      </mesh>
      {/* Pillar */}
      <mesh position={[0, h * 0.3, 0]} castShadow>
        <boxGeometry args={[0.22, h * 0.6, 0.22]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      {/* Screen housing, tilted slightly up toward the player */}
      <group position={[0, h * 0.75, 0.05]} rotation={[-0.2, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[w, 0.8, 0.14]} />
          <meshStandardMaterial color={YELLOW} />
        </mesh>
        <mesh position={[0, 0, 0.075]}>
          <planeGeometry args={[w - 0.14, 0.66]} />
          <meshStandardMaterial color="#bfe3ff" emissive="#7cc4ff" emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}

// Serving counter by the kiosk. The tray appears on top at TRAY_POS (y = 1).
function ServingCounter() {
  return (
    <group position={[0, 0, TRAY_POS[2]]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[COUNTER.w, 1, COUNTER.d]} />
        <meshStandardMaterial color={BLUE} />
      </mesh>
      <mesh position={[0, 1.02, 0]} receiveShadow>
        <boxGeometry args={[3.3, 0.05, 1]} />
        <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.4} />
      </mesh>
      {/* Heat lamp rail */}
      <mesh position={[0, 1.9, -0.3]}>
        <boxGeometry args={[3.2, 0.05, 0.05]} />
        <meshStandardMaterial color={STEEL} />
      </mesh>
    </group>
  )
}

// Tray rack ("brickhylla") beside the counter.
function TrayRack({ position }) {
  return (
    <group position={position}>
      {[0.5, 1, 1.5].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[TRAY_RACK.w, 0.04, TRAY_RACK.d]} />
          <meshStandardMaterial color={STEEL} metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      {[-TRAY_RACK.w / 2 + 0.02, TRAY_RACK.w / 2 - 0.02].map((x) => (
        <mesh key={x} position={[x, 0.8, 0]}>
          <boxGeometry args={[0.04, 1.6, TRAY_RACK.d]} />
          <meshStandardMaterial color={STEEL} />
        </mesh>
      ))}
    </group>
  )
}

function Astrid() {
  // Simple stand-in for Character.jsx's Astrid (that one carries the chase/snoring logic): same colours, standing still.
  return (
    <group position={[ASTRID_POS[0], 0, ASTRID_POS[2]]} rotation={[0, -Math.PI * 0.4, 0]}>
      {[-0.17, 0.17].map((x) => (
        <mesh key={x} position={[x, 0.4, 0]} castShadow>
          <boxGeometry args={[0.22, 0.8, 0.22]} />
          <meshStandardMaterial color="#2c3e6b" />
        </mesh>
      ))}
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[0.6, 0.6, 0.35]} />
        <meshStandardMaterial color="#e86fa0" />
      </mesh>
      {[-0.4, 0.4].map((x) => (
        <mesh key={x} position={[x, 1.0, 0]} castShadow>
          <boxGeometry args={[0.14, 0.55, 0.14]} />
          <meshStandardMaterial color="#e86fa0" />
        </mesh>
      ))}
      <mesh position={[0, 1.6, 0]} castShadow>
        <boxGeometry args={[0.42, 0.42, 0.42]} />
        <meshStandardMaterial color="#fdd8b5" />
      </mesh>
      <mesh position={[0, 1.67, -0.02]} castShadow>
        <boxGeometry args={[0.46, 0.34, 0.44]} />
        <meshStandardMaterial color="#5c3a21" />
      </mesh>
      {[-0.1, 0.1].map((x) => (
        <mesh key={x} position={[x, 1.6, 0.22]}>
          <boxGeometry args={[0.07, 0.07, 0.02]} />
          <meshStandardMaterial color="#4A90E2" />
        </mesh>
      ))}
    </group>
  )
}

// The knife shelf. KNIFE_SHELF_POS is where Rasmus stands: the shelf sits just behind it (-z).
function KnifeShelf() {
  const knives = useMemo(() => [-0.8, -0.5, -0.2, 0.1, 0.4, 0.7], [])
  return (
    <group position={[KNIFE_SHELF_POS[0], 0, KNIFE_SHELF_POS[2] + KNIFE_SHELF.offsetZ]}>
      <mesh position={[0, 1, -0.05]} castShadow>
        <boxGeometry args={[KNIFE_SHELF.w, 2, 0.1]} />
        <meshStandardMaterial color={WOOD} />
      </mesh>
      {[0.6, 1.2, 1.8].map((y) => (
        <mesh key={y} position={[0, y, 0.2]} castShadow>
          <boxGeometry args={[2.4, 0.05, 0.5]} />
          <meshStandardMaterial color={WOOD} />
        </mesh>
      ))}
      {/* Knife block-style row on the middle shelf, blades up */}
      {knives.map((x) => (
        <group key={x} position={[x, 1.25, 0.2]}>
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[0.04, 0.34, 0.01]} />
            <meshStandardMaterial color="#d8dde3" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <boxGeometry args={[0.05, 0.12, 0.03]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>
      ))}
      {/* Pots and pans on the top shelf */}
      {[-0.7, 0, 0.7].map((x) => (
        <mesh key={x} position={[x, 1.95, 0.2]}>
          <cylinderGeometry args={[0.2, 0.17, 0.2, 12]} />
          <meshStandardMaterial color="#555b63" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function KitchenDepartment() {
  return (
    <group>
      {/* Warmer tiled floor marks off the department */}
      <mesh position={[-18, 0.01, -15]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[16, 18]} />
        <meshStandardMaterial color="#8a6f4e" />
      </mesh>
      <KnifeShelf />
      {/* Fitted kitchens along the back wall */}
      {KITCHEN_UNITS.xs.map((x) => (
        <group key={x} position={[x, 0, Z_MIN + 0.45]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.9, 0.8]} />
            <meshStandardMaterial color={x < -15 ? YELLOW : '#e9e6df'} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[KITCHEN_UNITS.w, 0.05, KITCHEN_UNITS.d]} />
            <meshStandardMaterial color="#555" />
          </mesh>
          <mesh position={[0, 2.5, -0.1]}>
            <boxGeometry args={[3, 0.9, 0.5]} />
            <meshStandardMaterial color={x < -15 ? YELLOW : '#e9e6df'} />
          </mesh>
        </group>
      ))}
      {/* Display islands on both sides of Rasmus' corridor (x = -16) */}
      {KITCHEN_ISLANDS.positions.map(([x, z]) => (
        <group key={`${x}_${z}`} position={[x, 0, z]}>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[3, 0.9, 1.2]} />
            <meshStandardMaterial color={BLUE} />
          </mesh>
          <mesh position={[0, 0.92, 0]}>
            <boxGeometry args={[KITCHEN_ISLANDS.w, 0.05, KITCHEN_ISLANDS.d]} />
            <meshStandardMaterial color={WOOD} />
          </mesh>
        </group>
      ))}
      <Sign position={[-16, 3.6, Z_MIN + 0.4]} width={7} text="KÖKSAVDELNING" size={0.55} />
    </group>
  )
}

/**
 * The IKEA restaurant/store environment (floor, walls, ceiling, tables, kitchen department with the knife shelf).
 * Static, no props. Coordinates follow src/levels/ikeaLayout.js.
 * Owns the 3D kiosk (KIOSK_POS / KIOSK_SIZE / KIOSK_FACING) and the standing Astrid (ASTRID_POS);
 * the clickable overlay is OrderKiosk.jsx. The only shadow caster in the scene is the
 * directional light from Lighting.jsx (variant 'ikea'); only a few big pieces cast shadows.
 */
function IkeaStore() {
  const chairGeo = useMemo(makeChairGeometry, [])
  const tableGeos = useMemo(() => TABLE_LENGTHS.map(makeTableGeometry), [])
  const cx = (X_MIN + X_MAX) / 2
  const cz = (Z_MIN + Z_MAX) / 2
  const w = X_MAX - X_MIN
  const d = Z_MAX - Z_MIN

  return (
    <>
      {/* Floor, ceiling */}
      <mesh position={[cx, 0, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#c9c5b8" />
      </mesh>
      <mesh position={[cx, CEILING_Y, cz]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
      {/* Walls (blue, with a yellow stripe) */}
      {[
        { p: [cx, CEILING_Y / 2, Z_MIN], r: 0, len: w },
        { p: [cx, CEILING_Y / 2, Z_MAX], r: Math.PI, len: w },
        { p: [X_MIN, CEILING_Y / 2, cz], r: Math.PI / 2, len: d },
        { p: [X_MAX, CEILING_Y / 2, cz], r: -Math.PI / 2, len: d },
      ].map(({ p, r, len }, i) => (
        <group key={i} position={p} rotation={[0, r, 0]}>
          <mesh receiveShadow>
            <planeGeometry args={[len, CEILING_Y]} />
            <meshStandardMaterial color={BLUE} />
          </mesh>
          <mesh position={[0, -CEILING_Y / 2 + 1.3, 0.01]}>
            <planeGeometry args={[len, 0.25]} />
            <meshStandardMaterial color={YELLOW} />
          </mesh>
        </group>
      ))}
      {/* Ceiling light panels in a grid; emissive only, the real lights are in Lighting.jsx */}
      {[-20, -12, -4, 4, 12].flatMap((x) =>
        [-18, -10, -2, 6].map((z) => (
          <mesh key={`${x}_${z}`} position={[x * 0.9 - 4, CEILING_Y - 0.03, z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.4, 0.5]} />
            <meshStandardMaterial color="#f2f8ff" emissive="#dbe9ff" emissiveIntensity={1.2} toneMapped={false} />
          </mesh>
        )),
      )}

      {TABLES_BY_LENGTH.map(({ length, placements }, i) => (
        <Instanced key={length} geometry={tableGeos[i]} placements={placements} color={WOOD} castShadow />
      ))}
      <Instanced geometry={chairGeo} placements={IKEA_CHAIRS} color={YELLOW} />

      <ServingCounter />
      <TrayRack position={TRAY_RACK.position} />
      <Kiosk />
      <Astrid />
      <KitchenDepartment />

      {/* Signs */}
      <Sign position={[0, 3.3, -0.9]} width={4.6} text="BESTÄLL HÄR" size={0.5} />
      <Sign position={[9, 3.3, Z_MIN + 0.1]} width={6.5} text="RESTAURANG" size={0.55} />
      <Sign position={[X_MAX - 0.1, 3, -6]} rotation={[0, -Math.PI / 2, 0]} width={5} text="KÖTTBULLAR 16 st" size={0.4} bg={YELLOW} fg={BLUE} />
    </>
  )
}

export default IkeaStore

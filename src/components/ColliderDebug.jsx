import { SHOW_COLLIDERS } from '../testMode'

/**
 * Draws the level's collision boxes as magenta wireframes. Only with
 * ?colliders=1 in a test build (SHOW_COLLIDERS, see testMode.js); in prod and
 * without the flag it renders nothing. Boxes are 2D (XZ); they are drawn from
 * the floor up to `height`.
 */
function ColliderDebug({ colliders, height = 2.5 }) {
  if (!SHOW_COLLIDERS || !colliders) return null
  return (
    <group name="collider-debug">
      {colliders.map((b, i) => (
        <mesh key={i} name="collider-debug-box" position={[(b.minX + b.maxX) / 2, height / 2, (b.minZ + b.maxZ) / 2]}>
          <boxGeometry args={[Math.max(b.maxX - b.minX, 0.02), height, Math.max(b.maxZ - b.minZ, 0.02)]} />
          <meshBasicMaterial color="#ff00ff" wireframe depthTest={false} />
        </mesh>
      ))}
    </group>
  )
}

export default ColliderDebug

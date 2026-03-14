import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// Invisible trigger near the classroom door (right wall, z=4)
function ClassroomExit({ hasKey, onExit }) {
  const { camera } = useThree()
  const hasExitedRef = useRef(false)

  useEffect(() => {
    hasExitedRef.current = false
  }, [hasKey])

  useFrame(() => {
    if (!hasKey) return

    // Door is at position [8.85, 1.5, 4] in Classroom.jsx
    const doorPos = new THREE.Vector3(8.85, 1.5, 4)
    const distance = camera.position.distanceTo(doorPos)

    if (distance > 5) {
      hasExitedRef.current = false
    }

    if (distance < 2.5 && !hasExitedRef.current) {
      hasExitedRef.current = true
      onExit()
    }
  })

  return null
}

export default ClassroomExit

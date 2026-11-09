import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { CLASSROOM_DOOR } from '../levels/classroomLayout'

// Invisible trigger near the classroom door (right wall, z=4)
function ClassroomExit({ hasKey, onExit }) {
  const { camera } = useThree()
  const hasExitedRef = useRef(false)

  useEffect(() => {
    hasExitedRef.current = false
  }, [hasKey])

  useFrame(() => {
    if (!hasKey) return

    // The door's centre (Classroom.jsx, levels/classroomLayout.js). The door itself is solid
    // (levels/colliders/classroom.js); the trigger fires before the player touches it.
    const doorPos = new THREE.Vector3(CLASSROOM_DOOR.x, CLASSROOM_DOOR.y, CLASSROOM_DOOR.z)
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

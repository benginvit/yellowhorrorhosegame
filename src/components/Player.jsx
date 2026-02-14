import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Player({ mobileMovement = { x: 0, y: 0 }, mobileRotation = { x: 0, y: 0 } }) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const keys = useRef({})
  const rotation = useRef({ yaw: 0, pitch: 0 })
  const moveSpeed = 5
  const rotateSpeed = 2

  useEffect(() => {
    const handleKeyDown = (e) => {
      keys.current[e.code] = true
    }

    const handleKeyUp = (e) => {
      keys.current[e.code] = false
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  useFrame((state, delta) => {
    // Keyboard rotation controls
    const rotSpeed = rotateSpeed * delta

    if (keys.current['ArrowLeft'] || keys.current['KeyQ']) {
      rotation.current.yaw += rotSpeed
    }
    if (keys.current['ArrowRight'] || keys.current['KeyE']) {
      rotation.current.yaw -= rotSpeed
    }
    if (keys.current['ArrowUp']) {
      rotation.current.pitch += rotSpeed
    }
    if (keys.current['ArrowDown']) {
      rotation.current.pitch -= rotSpeed
    }

    // Mobile rotation controls
    if (mobileRotation.x !== 0 || mobileRotation.y !== 0) {
      rotation.current.yaw -= mobileRotation.x
      rotation.current.pitch -= mobileRotation.y
    }

    // Clamp pitch to prevent camera flipping
    rotation.current.pitch = THREE.MathUtils.clamp(rotation.current.pitch, -Math.PI / 3, Math.PI / 3)

    // Apply rotation to camera
    const euler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)

    // Reset velocity
    velocity.current.set(0, 0, 0)

    // Get camera direction vectors
    const forward = new THREE.Vector3()
    const right = new THREE.Vector3()

    camera.getWorldDirection(forward)
    forward.y = 0
    forward.normalize()

    right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

    // Apply movement based on keys
    const speed = moveSpeed * delta

    if (keys.current['KeyW']) {
      velocity.current.add(forward.clone().multiplyScalar(speed))
    }
    if (keys.current['KeyS']) {
      velocity.current.add(forward.clone().multiplyScalar(-speed))
    }
    if (keys.current['KeyA']) {
      velocity.current.add(right.clone().multiplyScalar(-speed))
    }
    if (keys.current['KeyD']) {
      velocity.current.add(right.clone().multiplyScalar(speed))
    }

    // Mobile joystick movement
    if (mobileMovement.x !== 0 || mobileMovement.y !== 0) {
      velocity.current.add(right.clone().multiplyScalar(mobileMovement.x * speed * 2))
      velocity.current.add(forward.clone().multiplyScalar(-mobileMovement.y * speed * 2))
    }

    // Apply velocity to camera
    camera.position.add(velocity.current)

    // Keep camera at player height
    camera.position.y = 1.6

    // Boundaries to prevent going too far
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -45, 45)
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -45, 45)
  })

  return null
}

export default Player

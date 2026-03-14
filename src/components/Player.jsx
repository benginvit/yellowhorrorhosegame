import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

function Player({
  mobileMovement = { x: 0, y: 0 },
  mobileRotation = { x: 0, y: 0 },
  isLocked = false,
  startPosition = null,
  startYaw = 0, // default: facing -z (toward whiteboard)
  inClassroom = false
}) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const keys = useRef({})
  const rotation = useRef({ yaw: startYaw, pitch: 0 })
  const moveSpeed = 5
  const rotateSpeed = 2
  const initialized = useRef(false)

  // Set starting position/rotation on first render
  useEffect(() => {
    if (!initialized.current) {
      if (startPosition) {
        camera.position.set(startPosition[0], startPosition[1], startPosition[2])
      }
      rotation.current.yaw = startYaw
      const euler = new THREE.Euler(0, startYaw, 0, 'YXZ')
      camera.quaternion.setFromEuler(euler)
      initialized.current = true
    }
  }, [camera, startPosition, startYaw])

  // Reset when startPosition changes (new level)
  useEffect(() => {
    initialized.current = false
    rotation.current.yaw = startYaw
    rotation.current.pitch = 0
  }, [startPosition, startYaw])

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
    // When locked (intro sequence) - just keep camera fixed
    if (isLocked) {
      if (startPosition) {
        camera.position.set(startPosition[0], startPosition[1], startPosition[2])
      }
      const euler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ')
      camera.quaternion.setFromEuler(euler)
      return
    }

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

    if (inClassroom) {
      // Tighter boundaries inside classroom
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -8.5, 8.5)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -7.5, 5.8)
    } else {
      // Outdoor boundaries
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -45, 45)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -45, 45)
    }
  })

  return null
}

export default Player

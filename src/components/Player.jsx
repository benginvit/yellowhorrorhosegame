import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { HIDE_TRANSITION_SECONDS, UNDER_BED_YAW_RANGE, UNDER_BED_PITCH_RANGE, UNDER_BED_PITCH } from '../levels/astridLayout'

function Player({
  mobileMovement = { x: 0, y: 0 },
  mobileRotation = { x: 0, y: 0 },
  isLocked = false,
  startPosition = null,
  startYaw = 0, // default: facing -z (toward whiteboard)
  inClassroom = false,
  lookBack = false, // view turned 180 degrees (yaw + PI); movement keys stay relative to the view
  bounds = null, // optional { minX, maxX, minZ, maxZ } rectangle the player stays inside (replaces the outdoor limits)
  pose = null, // optional { position: [x, y, z], yaw, locked }: while locked the camera eases to that pose and the player can only look around a little; unlocking eases back to where the player stood
  frozen = false // movement stopped, the view still turns and the position is kept (unlike isLocked, which resets it)
}) {
  const { camera } = useThree()
  const velocity = useRef(new THREE.Vector3())
  const keys = useRef({})
  const rotation = useRef({ yaw: startYaw, pitch: 0 })
  const moveSpeed = 5
  const rotateSpeed = 2
  const initialized = useRef(false)
  // Under-pose transition: 0 = standing (normal controls), 1 = in the pose. `stand` is where the player was when it started.
  const poseBlend = useRef(0)
  const poseActive = useRef(false)
  const stand = useRef(new THREE.Vector3())
  const underPos = useRef([0, 0.25, 0])

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
      const euler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw + (lookBack ? Math.PI : 0), 0, 'YXZ')
      camera.quaternion.setFromEuler(euler)
      return
    }

    const poseLocked = !!pose?.locked
    if (poseLocked && !poseActive.current) {
      poseActive.current = true
      stand.current.copy(camera.position)
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

    if (poseActive.current) {
      poseBlend.current = THREE.MathUtils.clamp(poseBlend.current + (poseLocked ? delta : -delta) / HIDE_TRANSITION_SECONDS, 0, 1)
      if (poseBlend.current === 0 && !poseLocked) {
        poseActive.current = false // back on its feet: normal controls from here
      } else {
        const p = THREE.MathUtils.smoothstep(poseBlend.current, 0, 1)
        if (poseLocked) underPos.current = pose.position
        const target = underPos.current
        if (poseLocked) {
          // Look out from under the bed: swing toward the pose's yaw, then free look within a small range around it.
          const swing = Math.atan2(Math.sin(pose.yaw - rotation.current.yaw), Math.cos(pose.yaw - rotation.current.yaw))
          if (poseBlend.current < 1) {
            rotation.current.yaw += swing * Math.min(1, delta * 8)
            rotation.current.pitch += (UNDER_BED_PITCH - rotation.current.pitch) * Math.min(1, delta * 8)
          } else {
            rotation.current.yaw = pose.yaw + THREE.MathUtils.clamp(-swing, -UNDER_BED_YAW_RANGE, UNDER_BED_YAW_RANGE)
          }
          rotation.current.pitch = THREE.MathUtils.clamp(rotation.current.pitch, UNDER_BED_PITCH - UNDER_BED_PITCH_RANGE, UNDER_BED_PITCH + UNDER_BED_PITCH_RANGE)
        }
        camera.position.set(
          THREE.MathUtils.lerp(stand.current.x, target[0], p),
          THREE.MathUtils.lerp(1.6, target[1], p),
          THREE.MathUtils.lerp(stand.current.z, target[2], p)
        )
        camera.quaternion.setFromEuler(new THREE.Euler(rotation.current.pitch, rotation.current.yaw, 0, 'YXZ'))
        return
      }
    }

    // Apply rotation to camera
    const euler = new THREE.Euler(rotation.current.pitch, rotation.current.yaw + (lookBack ? Math.PI : 0), 0, 'YXZ')
    camera.quaternion.setFromEuler(euler)

    // Reset velocity
    velocity.current.set(0, 0, 0)
    if (frozen) return

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

    if (bounds) {
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, bounds.minX, bounds.maxX)
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, bounds.minZ, bounds.maxZ)
    } else if (inClassroom) {
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

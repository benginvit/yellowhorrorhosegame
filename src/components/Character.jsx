import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { playHitSound, playJumpscareSound, playTickSound, playCatMeow, startSnoring, stopSnoring, playVoiceRecording } from '../utils/sounds'

function Character({
  level,
  onCatchPlayer,
  isAstridLevel = false,
  astridAwake = false,
  onWakeAstrid,
  isSleeping = false,
  isPlayerHiding = false,
  hideTimer,
  onUpdateHideTimer,
  language = 'en'
}) {
  const characterRef = useRef()
  const { camera } = useThree()
  const lastDamageTime = useRef(0)
  const countdownTimer = useRef(15)
  const hasRepositioned = useRef(false)
  const lastTickTime = useRef(0)

  useEffect(() => {
    // Reset position when level changes
    hasRepositioned.current = false
    if (characterRef.current) {
      if (isAstridLevel && isSleeping) {
        // Sleeping outside the house
        characterRef.current.position.set(5, 0.5, -20)
      } else if (isAstridLevel && !isSleeping && !astridAwake) {
        // Sleeping in the bed inside the house
        characterRef.current.position.set(5, 0.7, -20)
      } else {
        characterRef.current.position.set(-8, 1, -18)
      }
    }
  }, [level, isAstridLevel, isSleeping])

  useEffect(() => {
    // Wake Astrid after 2 seconds when player enters house
    let wakeTimer
    if (isAstridLevel && !astridAwake && !isSleeping && onWakeAstrid) {
      wakeTimer = setTimeout(() => {
        // Just call the callback - jumpscare and sound are handled in App.jsx
        onWakeAstrid()
      }, 2000)
    }
    return () => {
      if (wakeTimer) clearTimeout(wakeTimer)
    }
  }, [isAstridLevel, astridAwake, isSleeping, onWakeAstrid])

  // Random cat meows for Molltas (level 1)
  useEffect(() => {
    if (level.name === 'Molltas') {
      const scheduleMeow = () => {
        const delay = 3000 + Math.random() * 7000 // Random between 3-10 seconds
        return setTimeout(() => {
          playCatMeow(language) // Pass language for custom meow
          meowTimeout = scheduleMeow() // Schedule next meow
        }, delay)
      }

      let meowTimeout = scheduleMeow()

      return () => {
        if (meowTimeout) clearTimeout(meowTimeout)
      }
    }
  }, [level.name, language])

  // Snoring for sleeping Astrid
  useEffect(() => {
    if (isAstridLevel && !astridAwake) {
      startSnoring()
    } else {
      stopSnoring()
    }

    return () => {
      stopSnoring()
    }
  }, [isAstridLevel, astridAwake])

  useFrame((state, delta) => {
    if (characterRef.current) {
      const characterPos = characterRef.current.position

      // Astrid special behavior
      if (isAstridLevel) {
        if (isSleeping) {
          // Sleeping outside the house (laying down)
          characterRef.current.rotation.z = Math.PI / 2
          return
        }

        if (!astridAwake) {
          // Sleeping in the bed inside the house (laying down)
          characterRef.current.rotation.z = Math.PI / 2
          return
        }

        // Reset rotation when awake and reposition next to bed (once)
        characterRef.current.rotation.z = 0
        if (!hasRepositioned.current) {
          characterRef.current.position.set(3, 1, -20)
          hasRepositioned.current = true
        }

        // Inside house - start countdown timer immediately
        if (onUpdateHideTimer) {
          const previousTime = countdownTimer.current
          countdownTimer.current -= delta
          const newTime = Math.max(0, countdownTimer.current)
          onUpdateHideTimer(newTime)

          // Play tick sound every second, louder and higher pitched when under 5 seconds
          const currentSecond = Math.floor(newTime)
          const previousSecond = Math.floor(previousTime)

          if (currentSecond !== previousSecond && newTime > 0) {
            const isUrgent = newTime <= 5
            playTickSound(isUrgent)
          }

          if (countdownTimer.current <= 0 && !isPlayerHiding) {
            // Time ran out and player is not hiding - handled in App.jsx
            return
          }
        }

        // If player is hiding, Astrid can't see them
        if (isPlayerHiding) {
          // Astrid looks around confused
          characterRef.current.rotation.y += delta * 0.5
          return
        }

        // Chase player if not hiding and timer is still running
        if (countdownTimer.current > 0) {
          const direction = new THREE.Vector3()
          direction.subVectors(camera.position, characterPos)
          direction.y = 0
          direction.normalize()

          const speed = level.speed * delta
          characterRef.current.position.add(direction.multiplyScalar(speed))
          characterRef.current.position.y = 1

          characterRef.current.lookAt(camera.position.x, characterRef.current.position.y, camera.position.z)

          // Check distance to player
          const distance = Math.sqrt(
            Math.pow(camera.position.x - characterPos.x, 2) +
            Math.pow(camera.position.z - characterPos.z, 2)
          )

          if (distance < 2) {
            const currentTime = state.clock.elapsedTime
            if (currentTime - lastDamageTime.current > 0.5) {
              // Try custom voice recording first
              playVoiceRecording(level.name, 'catch', language)
              onCatchPlayer(25)
              lastDamageTime.current = currentTime
            }
          }
        }
      } else {
        // Normal character behavior for other levels
        const direction = new THREE.Vector3()
        direction.subVectors(camera.position, characterPos)
        direction.y = 0
        direction.normalize()

        const speed = level.speed * delta
        characterRef.current.position.add(direction.multiplyScalar(speed))
        characterRef.current.position.y = 1

        characterRef.current.lookAt(camera.position.x, characterRef.current.position.y, camera.position.z)

        const distance = Math.sqrt(
          Math.pow(camera.position.x - characterPos.x, 2) +
          Math.pow(camera.position.z - characterPos.z, 2)
        )

        if (distance < 2) {
          const currentTime = state.clock.elapsedTime
          if (currentTime - lastDamageTime.current > 0.5) {
            // Try custom voice recording first
            playVoiceRecording(level.name, 'catch', language)
            onCatchPlayer(25)
            lastDamageTime.current = currentTime
          }
        }

        // Animate - simple bobbing
        characterRef.current.children.forEach((child, index) => {
          if (child.type === 'Mesh') {
            child.position.y = Math.sin(state.clock.elapsedTime * 4 + index) * 0.05
          }
        })
      }
    }
  })

  // Character appearance based on level
  const getCharacterAppearance = () => {
    switch (level.name) {
      case 'Molltas':
        return {
          skinColor: '#ffffff',
          hairColor: '#ffffff',
          eyeColor: '#87CEEB',
          bodySize: [0.8, 1.5, 0.5],
          headSize: [0.7, 0.7, 0.7],
          isCat: true,
          isLarge: false
        }
      case 'Astrid':
        return {
          skinColor: '#fdd8b5',
          hairColor: '#5c3a21',
          eyeColor: '#4A90E2',
          bodySize: [0.8, 1.8, 0.5],
          headSize: [0.7, 0.8, 0.7],
          isCat: false,
          isLarge: false
        }
      case 'Selma':
        return {
          skinColor: '#fdd8b5',
          hairColor: '#f5e6a8',
          eyeColor: '#4A90E2',
          bodySize: [0.7, 1.6, 0.5],
          headSize: [0.65, 0.75, 0.65],
          isCat: false,
          isLarge: false
        }
      case 'Kerstin':
        return {
          skinColor: '#fdd8b5',
          hairColor: '#f5e6a8',
          eyeColor: '#4A90E2',
          bodySize: [0.8, 1.8, 0.5],
          headSize: [0.7, 0.8, 0.7],
          isCat: false,
          isLarge: false,
          hasLongHair: true
        }
      case 'Maria':
        return {
          skinColor: '#fdd8b5',
          hairColor: '#5c3a21',
          eyeColor: '#4A90E2',
          bodySize: [0.9, 2, 0.6],
          headSize: [0.75, 0.85, 0.75],
          isCat: false,
          isLarge: false
        }
      case 'Pappa':
        return {
          skinColor: '#fdd8b5',
          hairColor: '#5c3a21',
          eyeColor: '#ff0000',
          bodySize: [1.2, 2.5, 0.8],
          headSize: [0.9, 1, 0.9],
          isCat: false,
          isLarge: true
        }
      default:
        return {
          skinColor: '#fdd8b5',
          hairColor: '#5c3a21',
          eyeColor: '#4A90E2',
          bodySize: [0.8, 1.8, 0.5],
          headSize: [0.7, 0.8, 0.7],
          isCat: false,
          isLarge: false
        }
    }
  }

  const appearance = getCharacterAppearance()
  const yOffset = appearance.isLarge ? 1.3 : 1

  return (
    <group ref={characterRef} position={[-8, yOffset, -18]}>
      {/* Body */}
      <mesh castShadow>
        <boxGeometry args={appearance.bodySize} />
        <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : '#666666'} />
      </mesh>

      {/* Head */}
      <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={appearance.headSize} />
        <meshStandardMaterial color={appearance.skinColor} />
      </mesh>

      {/* Hair */}
      {!appearance.isCat && (
        <>
          <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] + 0.15, 0]} castShadow>
            <boxGeometry args={[appearance.headSize[0] + 0.1, 0.3, appearance.headSize[2] + 0.1]} />
            <meshStandardMaterial color={appearance.hairColor} />
          </mesh>

          {/* Long hair for Kerstin */}
          {appearance.hasLongHair && (
            <>
              <mesh position={[0, appearance.bodySize[1] / 2 + 0.3, -0.4]} castShadow>
                <boxGeometry args={[0.7, 1.2, 0.3]} />
                <meshStandardMaterial color={appearance.hairColor} />
              </mesh>
              {/* Curly sides */}
              <mesh position={[-0.4, appearance.bodySize[1] / 2 + 0.5, -0.2]} castShadow>
                <boxGeometry args={[0.2, 1, 0.2]} />
                <meshStandardMaterial color={appearance.hairColor} />
              </mesh>
              <mesh position={[0.4, appearance.bodySize[1] / 2 + 0.5, -0.2]} castShadow>
                <boxGeometry args={[0.2, 1, 0.2]} />
                <meshStandardMaterial color={appearance.hairColor} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* Eyes */}
      <mesh position={[-0.15, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 + 0.15, appearance.headSize[2] / 2 + 0.05]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={appearance.eyeColor}
          emissive={appearance.eyeColor === '#ff0000' ? '#ff0000' : '#000000'}
          emissiveIntensity={appearance.eyeColor === '#ff0000' ? 0.8 : 0}
        />
      </mesh>

      <mesh position={[0.15, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 + 0.15, appearance.headSize[2] / 2 + 0.05]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshStandardMaterial
          color={appearance.eyeColor}
          emissive={appearance.eyeColor === '#ff0000' ? '#ff0000' : '#000000'}
          emissiveIntensity={appearance.eyeColor === '#ff0000' ? 0.8 : 0}
        />
      </mesh>

      {/* Arms */}
      <mesh position={[-appearance.bodySize[0] / 2 - 0.15, appearance.bodySize[1] / 4, 0]} castShadow>
        <boxGeometry args={[0.25, appearance.bodySize[1] * 0.6, 0.25]} />
        <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : '#666666'} />
      </mesh>

      <mesh position={[appearance.bodySize[0] / 2 + 0.15, appearance.bodySize[1] / 4, 0]} castShadow>
        <boxGeometry args={[0.25, appearance.bodySize[1] * 0.6, 0.25]} />
        <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : '#666666'} />
      </mesh>

      {/* Legs */}
      <mesh position={[-appearance.bodySize[0] / 4, -appearance.bodySize[1] / 2 - 0.5, 0]} castShadow>
        <boxGeometry args={[0.3, 1, 0.3]} />
        <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : '#4a4a4a'} />
      </mesh>

      <mesh position={[appearance.bodySize[0] / 4, -appearance.bodySize[1] / 2 - 0.5, 0]} castShadow>
        <boxGeometry args={[0.3, 1, 0.3]} />
        <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : '#4a4a4a'} />
      </mesh>

      {/* Cat ears */}
      {appearance.isCat && (
        <>
          <mesh position={[-0.25, appearance.bodySize[1] / 2 + appearance.headSize[1] + 0.2, 0]} castShadow>
            <coneGeometry args={[0.15, 0.4, 3]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.25, appearance.bodySize[1] / 2 + appearance.headSize[1] + 0.2, 0]} castShadow>
            <coneGeometry args={[0.15, 0.4, 3]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </>
      )}

      {/* Red glow for scary effect (stronger for Pappa) */}
      <pointLight
        intensity={appearance.isLarge ? 1.5 : 0.5}
        distance={appearance.isLarge ? 5 : 3}
        color="#ff0000"
      />
    </group>
  )
}

export default Character

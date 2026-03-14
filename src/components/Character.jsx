import { useRef, useEffect, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Text } from '@react-three/drei'
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
  language = 'en',
  startPosition = null
}) {
  const characterRef = useRef()
  const { camera } = useThree()
  const lastDamageTime = useRef(0)
  const countdownTimer = useRef(15)
  const hasRepositioned = useRef(false)
  const lastTickTime = useRef(0)
  const [snoringBubbles, setSnoringBubbles] = useState([])
  const snoringTimerRef = useRef(null)

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
      } else if (startPosition) {
        characterRef.current.position.set(startPosition[0], startPosition[1], startPosition[2])
      } else {
        characterRef.current.position.set(-8, 1, -18)
      }
    }
  }, [level, isAstridLevel, isSleeping])

  useEffect(() => {
    // Wake Astrid after 4 seconds when player enters house
    let wakeTimer
    if (isAstridLevel && !astridAwake && !isSleeping && onWakeAstrid) {
      wakeTimer = setTimeout(() => {
        // Just call the callback - jumpscare and sound are handled in App.jsx
        onWakeAstrid()
      }, 4000)
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
      startSnoring(language)
    } else {
      stopSnoring()
    }

    return () => {
      stopSnoring()
    }
  }, [isAstridLevel, astridAwake, language])

  // Snoring bubble animation
  useEffect(() => {
    if (isAstridLevel && !astridAwake) {
      // Create new "Z" bubble every 1.5 seconds
      const createBubble = () => {
        const newBubble = {
          id: Math.random(),
          opacity: 1,
          yOffset: 0
        }
        setSnoringBubbles(prev => [...prev, newBubble])

        // Remove bubble after 2 seconds
        setTimeout(() => {
          setSnoringBubbles(prev => prev.filter(b => b.id !== newBubble.id))
        }, 2000)
      }

      // Create bubbles at regular intervals
      createBubble()
      snoringTimerRef.current = setInterval(createBubble, 1500)

      return () => {
        if (snoringTimerRef.current) {
          clearInterval(snoringTimerRef.current)
        }
        setSnoringBubbles([])
      }
    } else {
      setSnoringBubbles([])
    }
  }, [isAstridLevel, astridAwake])

  useFrame((state, delta) => {
    // Animate snoring bubbles
    if (snoringBubbles.length > 0) {
      setSnoringBubbles(prev => prev.map(bubble => ({
        ...bubble,
        yOffset: bubble.yOffset + delta * 0.8,
        opacity: Math.max(0, bubble.opacity - delta * 0.5)
      })))
    }

    if (characterRef.current) {
      const characterPos = characterRef.current.position

      // Astrid special behavior
      if (isAstridLevel) {
        if (isSleeping) {
          // Sleeping outside the house (laying down on side, perpendicular to bed)
          characterRef.current.rotation.x = Math.PI / 2
          return
        }

        if (!astridAwake) {
          // Sleeping in the bed inside the house (laying down on side, perpendicular to bed)
          characterRef.current.rotation.x = Math.PI / 2
          return
        }

        // Reset rotation when awake and reposition next to bed (once)
        characterRef.current.rotation.x = 0
        characterRef.current.rotation.y = 0
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

        // Astrid doesn't chase or catch the player - just looks around
        // The challenge is to hide before the timer runs out!
        characterRef.current.rotation.y += delta * 0.5
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
          skinColor: '#f5c08a',
          hairColor: '#3d2200',
          eyeColor: '#2c5f2e',
          bodySize: [0.52, 2.2, 0.3],
          headSize: [0.62, 0.68, 0.62],
          isCat: false,
          isLarge: false,
          hasLongHair: true,
          shirtColor: '#1a1a1a',
          pantsColor: '#1e4080',
          hasGun: true,
          hasSkinHands: true,
          isKerstin: true,
          armLength: 1.5
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
    <>
      {/* Character group */}
      <group ref={characterRef} position={startPosition ? [startPosition[0], startPosition[1], startPosition[2]] : [-8, yOffset, -18]}>
        {/* Body */}
        <mesh castShadow>
          <boxGeometry args={appearance.bodySize} />
          <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : (appearance.shirtColor || '#666666')} />
        </mesh>

        {/* Head */}
        <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 + 0.1, 0]} castShadow>
          <boxGeometry args={appearance.headSize} />
          <meshStandardMaterial color={appearance.skinColor} />
        </mesh>

        {/* Hair */}
        {!appearance.isCat && !appearance.hasLongHair && (
          <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] + 0.15, 0]} castShadow>
            <boxGeometry args={[appearance.headSize[0] + 0.1, 0.3, appearance.headSize[2] + 0.1]} />
            <meshStandardMaterial color={appearance.hairColor} />
          </mesh>
        )}

        {/* Curly hair for Kerstin */}
        {appearance.hasLongHair && (() => {
          const hx = appearance.headSize[0] / 2
          const hy = appearance.bodySize[1] / 2 + appearance.headSize[1]
          const hz = appearance.headSize[2] / 2
          const c = appearance.hairColor
          // top curls
          const topCurls = [
            [0, 0.18, 0], [-hx + 0.05, 0.1, 0.05], [hx - 0.05, 0.1, 0.05],
            [-hx + 0.1, 0.18, -0.05], [hx - 0.1, 0.18, -0.05],
            [0, 0.1, -hz + 0.08], [-0.15, 0.22, -0.1], [0.15, 0.22, -0.1],
          ]
          // back curly strands flowing down
          const backCurls = [0, 0.38, 0.7, 1.0, 1.28, 1.5].map((dy, i) => ({
            pos: [(i % 2 === 0 ? 0.08 : -0.08), hy - dy - 0.1, -hz - 0.1],
            r: 0.19 - dy * 0.01
          }))
          // side strands
          const sideCurls = [0, 0.3, 0.6, 0.9].flatMap((dy) => [
            { pos: [-hx - 0.08, hy - dy, 0.02], r: 0.13 },
            { pos: [hx + 0.08, hy - dy, 0.02], r: 0.13 },
          ])
          return (
            <>
              {topCurls.map(([ox, oy, oz], i) => (
                <mesh key={`tc${i}`} position={[ox, hy + oy, oz]} castShadow>
                  <sphereGeometry args={[0.21, 7, 7]} />
                  <meshStandardMaterial color={c} />
                </mesh>
              ))}
              {backCurls.map(({ pos, r }, i) => (
                <mesh key={`bc${i}`} position={pos} castShadow>
                  <sphereGeometry args={[r, 7, 7]} />
                  <meshStandardMaterial color={c} />
                </mesh>
              ))}
              {sideCurls.map(({ pos, r }, i) => (
                <mesh key={`sc${i}`} position={pos} castShadow>
                  <sphereGeometry args={[r, 7, 7]} />
                  <meshStandardMaterial color={c} />
                </mesh>
              ))}
            </>
          )
        })()}

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

        {/* Nose + mouth for human characters */}
        {appearance.isKerstin && (
          <>
            {/* Nose */}
            <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 + 0.05, appearance.headSize[2] / 2 + 0.08]}>
              <boxGeometry args={[0.08, 0.08, 0.1]} />
              <meshStandardMaterial color="#e8a882" />
            </mesh>
            {/* Mouth */}
            <mesh position={[0, appearance.bodySize[1] / 2 + appearance.headSize[1] / 2 - 0.08, appearance.headSize[2] / 2 + 0.05]}>
              <boxGeometry args={[0.2, 0.05, 0.06]} />
              <meshStandardMaterial color="#c0605a" />
            </mesh>
          </>
        )}

        {/* Arms */}
        {(() => {
          const armLen = appearance.armLength || appearance.bodySize[1] * 0.5
          const armW = 0.16
          const armY = appearance.bodySize[1] * 0.72
          const armHandY = armY - armLen / 2 - 0.1
          return (
            <>
              <mesh position={[-appearance.bodySize[0] / 2 - 0.1, armY - armLen / 2, 0]} castShadow>
                <boxGeometry args={[armW, armLen, armW]} />
                <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : (appearance.shirtColor || '#666666')} />
              </mesh>
              {appearance.hasSkinHands && (
                <mesh position={[-appearance.bodySize[0] / 2 - 0.1, armHandY, 0]} castShadow>
                  <boxGeometry args={[0.17, 0.17, 0.15]} />
                  <meshStandardMaterial color={appearance.skinColor} />
                </mesh>
              )}
              <mesh position={[appearance.bodySize[0] / 2 + 0.1, armY - armLen / 2, 0]} castShadow>
                <boxGeometry args={[armW, armLen, armW]} />
                <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : (appearance.shirtColor || '#666666')} />
              </mesh>
              {appearance.hasSkinHands && (
                <mesh position={[appearance.bodySize[0] / 2 + 0.1, armHandY, 0]} castShadow>
                  <boxGeometry args={[0.17, 0.17, 0.15]} />
                  <meshStandardMaterial color={appearance.skinColor} />
                </mesh>
              )}
            </>
          )
        })()}

        {/* Legs */}
        <mesh position={[-appearance.bodySize[0] / 4, -appearance.bodySize[1] / 2 - 0.5, 0]} castShadow>
          <boxGeometry args={[0.3, 1, 0.3]} />
          <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : (appearance.pantsColor || '#4a4a4a')} />
        </mesh>

        <mesh position={[appearance.bodySize[0] / 4, -appearance.bodySize[1] / 2 - 0.5, 0]} castShadow>
          <boxGeometry args={[0.3, 1, 0.3]} />
          <meshStandardMaterial color={appearance.isCat ? appearance.skinColor : (appearance.pantsColor || '#4a4a4a')} />
        </mesh>

        {/* Name on shirt */}
        {appearance.isKerstin && (
          <Text
            position={[0, appearance.bodySize[1] * 0.55, appearance.bodySize[2] / 2 + 0.01]}
            fontSize={0.13}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            KERSTIN
          </Text>
        )}

        {/* Gun in right hand */}
        {appearance.hasGun && (
          <group position={[appearance.bodySize[0] / 2 + 0.15, appearance.bodySize[1] / 4 - 0.3, 0.3]}
                 rotation={[Math.PI / 6, 0, 0]}>
            {/* Stock */}
            <mesh castShadow>
              <boxGeometry args={[0.12, 0.12, 0.8]} />
              <meshStandardMaterial color="#2a1a0a" />
            </mesh>
            {/* Barrel */}
            <mesh position={[0, 0.03, -0.75]} castShadow>
              <boxGeometry args={[0.07, 0.07, 0.7]} />
              <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Magazine */}
            <mesh position={[0, -0.12, 0.1]} castShadow>
              <boxGeometry args={[0.08, 0.22, 0.12]} />
              <meshStandardMaterial color="#111111" />
            </mesh>
            {/* Muzzle */}
            <mesh position={[0, 0.03, -1.15]} castShadow>
              <boxGeometry args={[0.09, 0.09, 0.12]} />
              <meshStandardMaterial color="#0a0a0a" metalness={0.9} />
            </mesh>
          </group>
        )}

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

      {/* Snoring bubbles - separate from character to float upward in world space */}
      {isAstridLevel && !astridAwake && characterRef.current && snoringBubbles.map((bubble) => {
        const charPos = characterRef.current.position
        return (
          <Text
            key={bubble.id}
            position={[charPos.x, charPos.y + 1.5 + bubble.yOffset, charPos.z]}
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.02}
            outlineColor="#000000"
          >
            Z
            <meshBasicMaterial opacity={bubble.opacity} transparent />
          </Text>
        )
      })}
    </>
  )
}

export default Character

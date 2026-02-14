import { useEffect, useRef, useState } from 'react'

function MobileControls({ onMove, onRotate }) {
  const [joystickActive, setJoystickActive] = useState(false)
  const [joystickPosition, setJoystickPosition] = useState({ x: 0, y: 0 })
  const joystickRef = useRef(null)
  const touchStartPos = useRef({ x: 0, y: 0 })
  const rotationTouchId = useRef(null)
  const lastRotationPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const handleTouchStart = (e) => {
      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i]
        const rect = e.target.getBoundingClientRect()

        // Left side of screen - joystick for movement
        if (touch.clientX < window.innerWidth / 2) {
          setJoystickActive(true)
          touchStartPos.current = { x: touch.clientX, y: touch.clientY }
        }
        // Right side of screen - camera rotation
        else {
          rotationTouchId.current = touch.identifier
          lastRotationPos.current = { x: touch.clientX, y: touch.clientY }
        }
      }
    }

    const handleTouchMove = (e) => {
      e.preventDefault()

      for (let i = 0; i < e.touches.length; i++) {
        const touch = e.touches[i]

        // Handle joystick movement
        if (touch.clientX < window.innerWidth / 2 && joystickActive) {
          const deltaX = touch.clientX - touchStartPos.current.x
          const deltaY = touch.clientY - touchStartPos.current.y

          // Clamp joystick movement
          const maxDistance = 50
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
          const clampedDistance = Math.min(distance, maxDistance)
          const angle = Math.atan2(deltaY, deltaX)

          const x = Math.cos(angle) * clampedDistance
          const y = Math.sin(angle) * clampedDistance

          setJoystickPosition({ x, y })

          // Normalize movement vector
          const normalizedX = x / maxDistance
          const normalizedY = y / maxDistance

          onMove({ x: normalizedX, y: normalizedY })
        }
        // Handle camera rotation
        else if (touch.identifier === rotationTouchId.current) {
          const deltaX = touch.clientX - lastRotationPos.current.x
          const deltaY = touch.clientY - lastRotationPos.current.y

          onRotate({ x: deltaX * 0.01, y: deltaY * 0.01 })

          lastRotationPos.current = { x: touch.clientX, y: touch.clientY }
        }
      }
    }

    const handleTouchEnd = (e) => {
      // Check if joystick touch ended
      let joystickTouchActive = false
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].clientX < window.innerWidth / 2) {
          joystickTouchActive = true
          break
        }
      }

      if (!joystickTouchActive) {
        setJoystickActive(false)
        setJoystickPosition({ x: 0, y: 0 })
        onMove({ x: 0, y: 0 })
      }

      // Check if rotation touch ended
      let rotationTouchActive = false
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === rotationTouchId.current) {
          rotationTouchActive = true
          break
        }
      }

      if (!rotationTouchActive) {
        rotationTouchId.current = null
      }
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: false })
    document.addEventListener('touchmove', handleTouchMove, { passive: false })
    document.addEventListener('touchend', handleTouchEnd, { passive: false })

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [joystickActive, onMove, onRotate])

  return (
    <div className="mobile-controls">
      {/* Joystick */}
      <div className="joystick-area">
        {joystickActive && (
          <div className="joystick-base">
            <div
              className="joystick-handle"
              style={{
                transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`
              }}
            />
          </div>
        )}
      </div>

      {/* Touch hints */}
      <div className="touch-hint left">🕹️ Move</div>
      <div className="touch-hint right">👆 Look</div>
    </div>
  )
}

export default MobileControls

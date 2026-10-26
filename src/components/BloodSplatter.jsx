import { useEffect, useState } from 'react'
import { rand } from '../testMode'

function BloodSplatter({ show }) {
  const [splatters, setSplatters] = useState([])

  useEffect(() => {
    if (show) {
      // Create random blood splatters
      const newSplatters = []
      for (let i = 0; i < 15; i++) {
        newSplatters.push({
          id: i,
          left: rand() * 100,
          top: rand() * 100,
          size: 20 + rand() * 80,
          delay: rand() * 0.2,
          rotation: rand() * 360
        })
      }
      setSplatters(newSplatters)

      // Clear after animation
      const timer = setTimeout(() => {
        setSplatters([])
      }, 2000)

      return () => clearTimeout(timer)
    }
  }, [show])

  if (!show || splatters.length === 0) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 9998,
        pointerEvents: 'none'
      }}
    >
      {splatters.map((splatter) => (
        <div
          key={splatter.id}
          style={{
            position: 'absolute',
            left: `${splatter.left}%`,
            top: `${splatter.top}%`,
            width: `${splatter.size}px`,
            height: `${splatter.size}px`,
            background: 'radial-gradient(circle, #8B0000 0%, #660000 50%, transparent 70%)',
            borderRadius: `${rand() * 50}% ${rand() * 50}% ${rand() * 50}% ${rand() * 50}%`,
            animation: `splat 0.5s ease-out ${splatter.delay}s forwards`,
            transform: `rotate(${splatter.rotation}deg)`,
            opacity: 0
          }}
        />
      ))}

      {/* Red vignette overlay */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, transparent 30%, rgba(139, 0, 0, 0.5) 100%)',
          animation: 'vignetteFlash 1s ease-out'
        }}
      />

      <style>{`
        @keyframes splat {
          0% {
            transform: scale(0) rotate(${rand() * 360}deg);
            opacity: 0;
          }
          50% {
            transform: scale(1.2) rotate(${rand() * 360}deg);
            opacity: 0.8;
          }
          100% {
            transform: scale(1) rotate(${rand() * 360}deg);
            opacity: 0.6;
          }
        }

        @keyframes vignetteFlash {
          0% { opacity: 0; }
          20% { opacity: 1; }
          100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}

export default BloodSplatter

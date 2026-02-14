import { useEffect } from 'react'
import { playJumpscareSound } from '../utils/sounds'

function Jumpscare({ characterName, onComplete }) {
  useEffect(() => {
    playJumpscareSound()

    // Auto-complete after animation
    const timer = setTimeout(() => {
      onComplete()
    }, 800)

    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10000,
        pointerEvents: 'none',
        animation: 'jumpscare 0.8s ease-out forwards'
      }}
    >
      {/* Red flash */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          background: 'radial-gradient(circle, rgba(255,0,0,0.8) 0%, rgba(0,0,0,0.9) 100%)',
          animation: 'flash 0.8s ease-out'
        }}
      />

      {/* Scary face text */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '120px',
          fontWeight: 'bold',
          color: '#ff0000',
          textShadow: '0 0 20px #ff0000, 0 0 40px #000',
          animation: 'scaleIn 0.3s ease-out',
          fontFamily: 'Arial, sans-serif'
        }}
      >
        {characterName === 'Molltas' ? '🐱' : '👹'}
      </div>

      <style>{`
        @keyframes flash {
          0% { opacity: 0; }
          10% { opacity: 1; }
          100% { opacity: 0; }
        }

        @keyframes scaleIn {
          0% {
            transform: translate(-50%, -50%) scale(0.1);
            opacity: 0;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 1;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 1;
          }
        }

        @keyframes jumpscare {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-10px, 5px); }
          20% { transform: translate(10px, -5px); }
          30% { transform: translate(-8px, -8px); }
          40% { transform: translate(8px, 8px); }
          50% { transform: translate(-5px, 3px); }
          60% { transform: translate(5px, -3px); }
          70% { transform: translate(-3px, -3px); }
          80% { transform: translate(3px, 3px); }
          90% { transform: translate(-2px, 2px); }
        }
      `}</style>
    </div>
  )
}

export default Jumpscare

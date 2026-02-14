import { useEffect, useState } from 'react'

function Confetti() {
  const [confetti, setConfetti] = useState([])

  useEffect(() => {
    const pieces = []
    for (let i = 0; i < 100; i++) {
      pieces.push({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 3,
        duration: 3 + Math.random() * 2,
        color: ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#ff00ff', '#00ffff'][Math.floor(Math.random() * 6)]
      })
    }
    setConfetti(pieces)
  }, [])

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {confetti.map(piece => (
        <div
          key={piece.id}
          style={{
            position: 'absolute',
            left: `${piece.left}%`,
            top: '-10px',
            width: '10px',
            height: '10px',
            backgroundColor: piece.color,
            animation: `fall ${piece.duration}s linear ${piece.delay}s forwards`,
            opacity: 0.8
          }}
        />
      ))}
      <style>{`
        @keyframes fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}

export default Confetti

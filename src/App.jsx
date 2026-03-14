import { useState, useCallback, useEffect, useRef } from 'react'
import Game from './components/Game'
import UI from './components/UI'
import Jumpscare from './components/Jumpscare'
import BloodSplatter from './components/BloodSplatter'
import MobileControls from './components/MobileControls'
import { createHorrorMusic, stopAllSounds, initAudio, fadeOutMusic, playVoiceRecording, playJumpscareSound, stopVoiceRecordings, stopSnoring, preloadAudioFiles, playGunshotSound, playScreamSound } from './utils/sounds'

const INITIAL_STATE = {
  isPlaying: false,
  currentLevel: 1,
  hasKey: false,
  health: 100,
  gameOver: false,
  victory: false,
  isInsideHouse: false,
  isHiding: false,
  astridAwake: false,
  hideTimer: 15,
  levelComplete: false,
  classroomIntroPhase: null // null | 'seated' | 'shots' | 'panic' | 'active'
}

function App() {
  const [language, setLanguage] = useState(null)
  const [mobileMovement, setMobileMovement] = useState({ x: 0, y: 0 })
  const [mobileRotation, setMobileRotation] = useState({ x: 0, y: 0 })
  const [gameState, setGameState] = useState(INITIAL_STATE)

  const [showJumpscare, setShowJumpscare] = useState(false)
  const [showBloodSplatter, setShowBloodSplatter] = useState(false)
  const [showAstridJumpscare, setShowAstridJumpscare] = useState(false)
  const [showGomEr, setShowGomEr] = useState(false)
  const [showGunshotFlash, setShowGunshotFlash] = useState(false)
  const [showGunshotShake, setShowGunshotShake] = useState(false)

  const introTimersRef = useRef([])
  const introStartedRef = useRef(false)

  const levels = [
    { name: 'Molltas', description: 'White Cat', speed: 2.0 },
    { name: 'Astrid', description: '13 years old', speed: 1.8 },
    { name: 'Kerstin', description: '13 years old', speed: 2.3 },
    { name: 'Selma', description: '11 years old', speed: 2.0 },
    { name: 'Maria', description: '46 years old', speed: 2.6 },
    { name: 'Pappa', description: '48 years old', speed: 3.0 }
  ]

  // Start horror music when playing, level changes, or Astrid wakes up
  useEffect(() => {
    stopVoiceRecordings()

    let stopMusic
    if (gameState.isPlaying) {
      stopMusic = createHorrorMusic(gameState.currentLevel, gameState.astridAwake)
    }
    return () => {
      if (stopMusic) stopMusic()
      if (!gameState.isPlaying) stopAllSounds()
    }
  }, [gameState.isPlaying, gameState.currentLevel, gameState.astridAwake])

  // Fade out music when level complete
  useEffect(() => {
    if (gameState.levelComplete) {
      fadeOutMusic()
    }
  }, [gameState.levelComplete])

  // Classroom intro sequence for Kerstin level — runs ONCE when level starts
  useEffect(() => {
    const currentLevelData = levels[gameState.currentLevel - 1]
    if (!gameState.isPlaying || currentLevelData?.name !== 'Kerstin') {
      introStartedRef.current = false
      return
    }
    if (introStartedRef.current) return
    introStartedRef.current = true

    introTimersRef.current.forEach(t => clearTimeout(t))
    introTimersRef.current = []

    const t1 = setTimeout(() => {
      playGunshotSound()
      setShowGunshotFlash(true)
      setShowGunshotShake(true)
      setTimeout(() => setShowGunshotFlash(false), 300)
      setTimeout(() => setShowGunshotShake(false), 1800)
      setGameState(prev => ({ ...prev, classroomIntroPhase: 'shots' }))
    }, 7000)

    const t2 = setTimeout(() => {
      playGunshotSound()
      playScreamSound()
    }, 8500)

    const t3 = setTimeout(() => {
      setGameState(prev => ({ ...prev, classroomIntroPhase: 'panic' }))
      setShowGomEr(true)
    }, 9000)

    const t4 = setTimeout(() => {
      setShowGomEr(false)
      setGameState(prev => ({ ...prev, classroomIntroPhase: 'active' }))
    }, 12500)

    introTimersRef.current = [t1, t2, t3, t4]

    return () => {
      introTimersRef.current.forEach(t => clearTimeout(t))
      introStartedRef.current = false
    }
  }, [gameState.isPlaying, gameState.currentLevel])

  const startGame = () => {
    initAudio()
    if (language) preloadAudioFiles(language)

    setGameState({
      ...INITIAL_STATE,
      isPlaying: true,
    })
  }

  const restartGame = () => {
    stopAllSounds()
    introTimersRef.current.forEach(t => clearTimeout(t))
    setShowGomEr(false)
    setGameState(INITIAL_STATE)
  }

  const getNextLevelState = (prev) => {
    const nextLevel = prev.currentLevel + 1
    const nextLevelData = levels[nextLevel - 1]
    const isKerstinNext = nextLevelData?.name === 'Kerstin'

    return {
      ...prev,
      currentLevel: nextLevel,
      hasKey: false,
      health: 100,
      isInsideHouse: false,
      isHiding: false,
      astridAwake: false,
      hideTimer: 15,
      levelComplete: false,
      classroomIntroPhase: isKerstinNext ? 'seated' : null
    }
  }

  const nextLevel = () => {
    if (gameState.currentLevel < levels.length) {
      setGameState(prev => getNextLevelState(prev))
    } else {
      setGameState(prev => ({ ...prev, victory: true, isPlaying: false }))
    }
  }

  const collectKey = useCallback(() => {
    setGameState(prev => ({ ...prev, hasKey: true }))
  }, [])

  const takeDamage = useCallback((amount) => {
    setShowBloodSplatter(true)
    setTimeout(() => setShowBloodSplatter(false), 2000)

    setGameState(prev => {
      const newHealth = Math.max(0, prev.health - amount)
      if (newHealth <= 0) {
        return { ...prev, health: 0, gameOver: true, isPlaying: false }
      }
      return { ...prev, health: newHealth }
    })
  }, [])

  const enterHouse = useCallback(() => {
    setGameState(prev => ({ ...prev, isInsideHouse: true }))
  }, [])

  const setHiding = useCallback((hiding) => {
    setGameState(prev => ({ ...prev, isHiding: hiding }))
  }, [])

  const wakeAstrid = useCallback(() => {
    stopVoiceRecordings()
    stopSnoring()

    setShowAstridJumpscare(true)
    playJumpscareSound()
    setTimeout(() => setShowAstridJumpscare(false), 1500)

    setTimeout(() => {
      playVoiceRecording('Astrid', 'wake', language)
    }, 400)

    setGameState(prev => ({ ...prev, astridAwake: true }))
  }, [language])

  const updateHideTimer = useCallback((time) => {
    setGameState(prev => {
      if (prev.gameOver || prev.levelComplete) return prev

      if (time <= 0) {
        if (!prev.isHiding) {
          playVoiceRecording('Astrid', 'failed', language)
          return { ...prev, health: 0, gameOver: true, isPlaying: false, hideTimer: 0 }
        } else {
          fadeOutMusic()
          setTimeout(() => {
            playVoiceRecording('Astrid', 'success', language)
          }, 800)
          return { ...prev, hideTimer: 0, levelComplete: true }
        }
      }
      return { ...prev, hideTimer: time }
    })
  }, [language])

  const continueToNextLevel = () => {
    stopAllSounds()
    introTimersRef.current.forEach(t => clearTimeout(t))
    setShowGomEr(false)

    if (gameState.currentLevel < levels.length) {
      setGameState(prev => getNextLevelState(prev))
    } else {
      setGameState(prev => ({
        ...prev,
        victory: true,
        isPlaying: false,
        levelComplete: false
      }))
    }
  }

  const currentLevel = levels[gameState.currentLevel - 1]

  return (
    <>
      <UI
        gameState={gameState}
        levels={levels}
        language={language}
        onSelectLanguage={setLanguage}
        onStart={startGame}
        onRestart={restartGame}
        onContinue={continueToNextLevel}
      />
      {gameState.isPlaying && (
        <>
          <Game
            gameState={gameState}
            level={currentLevel}
            language={language}
            onCollectKey={collectKey}
            onNextLevel={nextLevel}
            onTakeDamage={takeDamage}
            onEnterHouse={enterHouse}
            onSetHiding={setHiding}
            onWakeAstrid={wakeAstrid}
            onUpdateHideTimer={updateHideTimer}
            mobileMovement={mobileMovement}
            mobileRotation={mobileRotation}
          />
          <MobileControls
            onMove={setMobileMovement}
            onRotate={setMobileRotation}
          />
        </>
      )}

      {/* Classroom intro: "Göm er!" overlay */}
      {showGomEr && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 9000,
          pointerEvents: 'none',
          animation: 'classroomShake 3.5s ease-out forwards'
        }}>
          {/* Dark vignette */}
          <div style={{
            position: 'absolute',
            width: '100%', height: '100%',
            background: 'radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.7) 100%)',
            animation: 'vignetteFade 3.5s ease-out forwards'
          }} />

          {/* Teacher screams */}
          <div style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            animation: 'teacherText 3.5s ease-out forwards',
            whiteSpace: 'nowrap'
          }}>
            <div style={{
              fontSize: 'clamp(16px, 3vw, 28px)',
              color: '#ffcc00',
              fontFamily: 'Arial, sans-serif',
              fontStyle: 'italic',
              textShadow: '2px 2px 8px rgba(0,0,0,0.9)',
              marginBottom: '12px'
            }}>
              Läraren skriker:
            </div>
            <div style={{
              fontSize: 'clamp(48px, 10vw, 120px)',
              fontWeight: 'bold',
              color: '#ff2200',
              fontFamily: 'Impact, Arial Black, sans-serif',
              textShadow: '0 0 20px #ff0000, 4px 4px 0px #000, 0 0 60px #ff0000',
              letterSpacing: '4px',
              animation: 'gomErPulse 0.5s ease-in-out infinite alternate'
            }}>
              GÖM ER!
            </div>
          </div>

          {/* Pops Academy logo top */}
          <div style={{
            position: 'absolute',
            top: '8%',
            left: '50%',
            transform: 'translateX(-50%)',
            fontSize: 'clamp(12px, 2vw, 20px)',
            color: 'rgba(255,255,255,0.5)',
            fontFamily: 'Arial, sans-serif',
            letterSpacing: '6px',
            textTransform: 'uppercase'
          }}>
            POPS ACADEMY
          </div>

          <style>{`
            @keyframes classroomShake {
              0%, 100% { transform: translate(0, 0); }
              3% { transform: translate(-12px, 8px); }
              6% { transform: translate(12px, -8px); }
              9% { transform: translate(-8px, -6px); }
              12% { transform: translate(8px, 6px); }
              16% { transform: translate(-5px, 3px); }
              20% { transform: translate(5px, -3px); }
              28% { transform: translate(-2px, 2px); }
              35% { transform: translate(2px, -2px); }
            }
            @keyframes vignetteFade {
              0% { opacity: 0; }
              10% { opacity: 1; }
              80% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes teacherText {
              0% { opacity: 0; transform: translateX(-50%) scale(1.5); }
              8% { opacity: 1; transform: translateX(-50%) scale(1); }
              75% { opacity: 1; transform: translateX(-50%) scale(1); }
              100% { opacity: 0; transform: translateX(-50%) scale(0.9); }
            }
            @keyframes gomErPulse {
              from { text-shadow: 0 0 20px #ff0000, 4px 4px 0px #000; }
              to { text-shadow: 0 0 40px #ff0000, 4px 4px 0px #000, 0 0 80px #ff6600; }
            }
          `}</style>
        </div>
      )}

      {/* Classroom: candy throw notification */}
      {gameState.classroomIntroPhase === 'shots' && (
        <div style={{
          position: 'fixed',
          bottom: '35%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 8500,
          pointerEvents: 'none',
          textAlign: 'center',
          animation: 'candyToastIn 0.4s ease-out forwards'
        }}>
          <div style={{
            fontSize: 'clamp(18px, 3.5vw, 32px)',
            fontWeight: 'bold',
            color: '#ffcc00',
            fontFamily: 'Arial, sans-serif',
            textShadow: '0 0 12px rgba(255,180,0,0.9), 2px 2px 0 #000',
            background: 'rgba(0,0,0,0.55)',
            padding: '10px 22px',
            borderRadius: '8px',
            border: '2px solid rgba(255,200,0,0.4)',
            whiteSpace: 'nowrap'
          }}>
            🍬 Läraren kastar godis!
          </div>
          <style>{`
            @keyframes candyToastIn {
              0% { opacity: 0; transform: translateX(-50%) translateY(20px); }
              100% { opacity: 1; transform: translateX(-50%) translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Classroom: grab candy hint during panic/active */}
      {(gameState.classroomIntroPhase === 'panic' || gameState.classroomIntroPhase === 'active') && !gameState.hasKey && (
        <div style={{
          position: 'fixed',
          bottom: '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 8500,
          pointerEvents: 'none',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: 'clamp(14px, 2.5vw, 22px)',
            color: '#ffffff',
            fontFamily: 'Arial, sans-serif',
            textShadow: '1px 1px 6px rgba(0,0,0,0.95)',
            background: 'rgba(180,0,0,0.6)',
            padding: '8px 20px',
            borderRadius: '6px',
            border: '1px solid rgba(255,100,100,0.5)',
            whiteSpace: 'nowrap',
            animation: 'candyHintPulse 1.8s ease-in-out infinite'
          }}>
            Ta ett godis innan eleverna äter allt!
          </div>
          <style>{`
            @keyframes candyHintPulse {
              0%, 100% { opacity: 0.85; }
              50% { opacity: 1; box-shadow: 0 0 16px rgba(255,80,80,0.6); }
            }
          `}</style>
        </div>
      )}

      {/* Gunshot screen shake */}
      {showGunshotShake && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 9400,
          pointerEvents: 'none',
          animation: 'gunshotShake 1.8s ease-out forwards'
        }}>
          <style>{`
            @keyframes gunshotShake {
              0%   { transform: translate(0, 0); }
              4%   { transform: translate(-18px, 12px); }
              8%   { transform: translate(18px, -12px); }
              12%  { transform: translate(-14px, -10px); }
              16%  { transform: translate(14px, 10px); }
              22%  { transform: translate(-10px, 7px); }
              28%  { transform: translate(10px, -7px); }
              36%  { transform: translate(-6px, 4px); }
              45%  { transform: translate(6px, -4px); }
              55%  { transform: translate(-3px, 2px); }
              65%  { transform: translate(3px, -2px); }
              80%  { transform: translate(-1px, 1px); }
              100% { transform: translate(0, 0); }
            }
          `}</style>
        </div>
      )}

      {/* Gunshot flash */}
      {showGunshotFlash && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          background: 'rgba(255, 240, 200, 0.85)',
          zIndex: 9500,
          pointerEvents: 'none',
          animation: 'gunshotFlash 0.3s ease-out forwards'
        }}>
          <style>{`
            @keyframes gunshotFlash {
              0% { opacity: 0; }
              10% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}

      {showJumpscare && (
        <Jumpscare
          characterName={currentLevel?.name}
          onComplete={() => setShowJumpscare(false)}
        />
      )}

      {showAstridJumpscare && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, width: '100%', height: '100%',
          zIndex: 10000,
          pointerEvents: 'none',
          animation: 'astridShake 1.5s ease-out forwards'
        }}>
          <div style={{
            position: 'absolute',
            width: '100%', height: '100%',
            background: 'radial-gradient(circle, rgba(200,0,0,0.95) 0%, rgba(0,0,0,0.98) 100%)',
            animation: 'astridFlash 1.5s ease-out forwards'
          }} />
          <div style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: '200px',
            animation: 'astridFace 1.5s ease-out forwards',
            filter: 'drop-shadow(0 0 30px red)'
          }}>😱</div>
          <div style={{
            position: 'absolute',
            top: '20%', left: '50%',
            transform: 'translateX(-50%)',
            fontSize: '80px',
            fontWeight: 'bold',
            color: '#ff0000',
            textShadow: '0 0 30px #ff0000, 0 0 60px #ff0000',
            fontFamily: 'Arial, sans-serif',
            animation: 'astridText 1.5s ease-out forwards',
            whiteSpace: 'nowrap'
          }}>ASTRID VAKNAR!</div>
          <style>{`
            @keyframes astridFlash {
              0% { opacity: 0; } 5% { opacity: 1; } 60% { opacity: 0.85; } 100% { opacity: 0; }
            }
            @keyframes astridFace {
              0% { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }
              10% { transform: translate(-50%, -50%) scale(1.5); opacity: 1; }
              30% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; }
              80% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
              100% { transform: translate(-50%, -50%) scale(0.8); opacity: 0; }
            }
            @keyframes astridText {
              0% { opacity: 0; transform: translateX(-50%) scale(2); }
              10% { opacity: 1; transform: translateX(-50%) scale(1); }
              70% { opacity: 1; }
              100% { opacity: 0; }
            }
            @keyframes astridShake {
              0%, 100% { transform: translate(0, 0); }
              5% { transform: translate(-20px, 15px); }
              10% { transform: translate(20px, -15px); }
              15% { transform: translate(-15px, -10px); }
              20% { transform: translate(15px, 10px); }
              25% { transform: translate(-10px, 8px); }
              30% { transform: translate(10px, -8px); }
              40% { transform: translate(-6px, 4px); }
              50% { transform: translate(6px, -4px); }
              60% { transform: translate(-3px, 2px); }
              70% { transform: translate(3px, -2px); }
            }
          `}</style>
        </div>
      )}

      <BloodSplatter show={showBloodSplatter} />
    </>
  )
}

export default App

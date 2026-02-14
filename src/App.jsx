import { useState, useCallback, useEffect } from 'react'
import Game from './components/Game'
import UI from './components/UI'
import Jumpscare from './components/Jumpscare'
import BloodSplatter from './components/BloodSplatter'
import { createHorrorMusic, stopAllSounds, initAudio, fadeOutMusic, playVoiceRecording, playJumpscareSound, stopVoiceRecordings, stopSnoring, preloadAudioFiles } from './utils/sounds'

function App() {
  const [language, setLanguage] = useState(null) // null = not selected yet
  const [gameState, setGameState] = useState({
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
    levelComplete: false
  })

  const [showJumpscare, setShowJumpscare] = useState(false)
  const [showBloodSplatter, setShowBloodSplatter] = useState(false)
  const [showQuickFlash, setShowQuickFlash] = useState(false)

  // Start horror music when playing, level changes, or Astrid wakes up
  useEffect(() => {
    // Stop any voice recordings (cat meows, etc.) when level changes
    stopVoiceRecordings()

    let stopMusic
    if (gameState.isPlaying) {
      // Pass astridAwake state to select appropriate music
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

  const levels = [
    { name: 'Molltas', description: 'White Cat', speed: 2.0 },
    { name: 'Astrid', description: '13 years old', speed: 1.8 },
    { name: 'Selma', description: '11 years old', speed: 2.0 },
    { name: 'Kerstin', description: '13 years old', speed: 2.3 },
    { name: 'Maria', description: '46 years old', speed: 2.6 },
    { name: 'Pappa', description: '48 years old', speed: 3.0 }
  ]

  const startGame = () => {
    // Initialize audio on user interaction
    initAudio()

    // Preload audio files for the selected language
    if (language) {
      preloadAudioFiles(language)
    }

    setGameState({
      isPlaying: true,
      currentLevel: 1,
      hasKey: false,
      health: 100,
      gameOver: false,
      victory: false,
      isInsideHouse: false,
      isHiding: false,
      astridAwake: false,
      hideTimer: 15,
      levelComplete: false
    })
  }

  const restartGame = () => {
    // Stop all sounds when restarting
    stopAllSounds()

    setGameState({
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
      levelComplete: false
    })
  }

  const nextLevel = () => {
    // Advance directly to next level (no confetti for normal levels)
    // Game ends after level 2
    if (gameState.currentLevel < 2) {
      setGameState(prev => ({
        ...prev,
        currentLevel: prev.currentLevel + 1,
        hasKey: false,
        health: 100,
        isInsideHouse: false,
        isHiding: false,
        astridAwake: false,
        hideTimer: 15,
        levelComplete: false
      }))
    } else {
      setGameState(prev => ({
        ...prev,
        victory: true,
        isPlaying: false
      }))
    }
  }

  const collectKey = useCallback(() => {
    setGameState(prev => ({ ...prev, hasKey: true }))
  }, [])

  const takeDamage = useCallback((amount) => {
    // Trigger visual effects
    setShowBloodSplatter(true)
    setTimeout(() => setShowBloodSplatter(false), 2000)

    // No more random jumpscares when taking damage

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
    // Stop all voice recordings including snoring immediately when Astrid wakes
    stopVoiceRecordings()

    // Double-check snoring is stopped
    stopSnoring()

    // Show quick red flash (super short) with sound
    setShowQuickFlash(true)
    playJumpscareSound() // Play scary sound with the flash
    setTimeout(() => setShowQuickFlash(false), 200)

    // Play voice right after the flash (slightly longer delay to ensure snoring stopped)
    setTimeout(() => {
      playVoiceRecording('Astrid', 'wake', language)
    }, 250)

    setGameState(prev => ({ ...prev, astridAwake: true }))
  }, [language])

  const updateHideTimer = useCallback((time) => {
    setGameState(prev => {
      // Don't do anything if already game over or level complete
      if (prev.gameOver || prev.levelComplete) {
        return prev
      }

      if (time <= 0) {
        if (!prev.isHiding) {
          // Failed to hide - play "Nu ska du få!" and show game over screen
          playVoiceRecording('Astrid', 'failed', language)
          return {
            ...prev,
            health: 0,
            gameOver: true,
            isPlaying: false,
            hideTimer: 0
          }
        } else {
          // Successfully hidden - play "Vart tog den vägen?" and show success message!
          // Fade out music first
          fadeOutMusic()

          // Play success voice after a short delay
          setTimeout(() => {
            playVoiceRecording('Astrid', 'success', language)
          }, 800)

          return {
            ...prev,
            hideTimer: 0,
            levelComplete: true
          }
        }
      }
      return { ...prev, hideTimer: time }
    })
  }, [language])

  const continueToNextLevel = () => {
    // Stop all sounds when continuing to prevent lingering audio
    stopAllSounds()

    // Game ends after level 2
    if (gameState.currentLevel < 2) {
      setGameState(prev => ({
        ...prev,
        currentLevel: prev.currentLevel + 1,
        hasKey: false,
        health: 100,
        isInsideHouse: false,
        isHiding: false,
        astridAwake: false,
        hideTimer: 15,
        levelComplete: false
      }))
    } else {
      setGameState(prev => ({
        ...prev,
        victory: true,
        isPlaying: false,
        levelComplete: false
      }))
    }
  }

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
        <Game
          gameState={gameState}
          level={levels[gameState.currentLevel - 1]}
          language={language}
          onCollectKey={collectKey}
          onNextLevel={nextLevel}
          onTakeDamage={takeDamage}
          onEnterHouse={enterHouse}
          onSetHiding={setHiding}
          onWakeAstrid={wakeAstrid}
          onUpdateHideTimer={updateHideTimer}
        />
      )}
      {showJumpscare && (
        <Jumpscare
          characterName={levels[gameState.currentLevel - 1]?.name}
          onComplete={() => setShowJumpscare(false)}
        />
      )}
      {showQuickFlash && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'radial-gradient(circle, rgba(255,0,0,0.9) 0%, rgba(0,0,0,0.7) 100%)',
            zIndex: 10000,
            pointerEvents: 'none',
            animation: 'quickFlash 0.2s ease-out'
          }}
        >
          <style>{`
            @keyframes quickFlash {
              0% { opacity: 0; }
              50% { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}
      <BloodSplatter show={showBloodSplatter} />
    </>
  )
}

export default App

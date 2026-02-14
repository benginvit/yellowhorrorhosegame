import { useState, useCallback, useEffect } from 'react'
import Game from './components/Game'
import UI from './components/UI'
import Jumpscare from './components/Jumpscare'
import BloodSplatter from './components/BloodSplatter'
import { createHorrorMusic, stopAllSounds, initAudio, fadeOutMusic, playVoiceRecording } from './utils/sounds'

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

  // Start horror music when playing or level changes
  useEffect(() => {
    let stopMusic
    if (gameState.isPlaying) {
      stopMusic = createHorrorMusic(gameState.currentLevel)
    }
    return () => {
      if (stopMusic) stopMusic()
      if (!gameState.isPlaying) stopAllSounds()
    }
  }, [gameState.isPlaying, gameState.currentLevel])

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
    if (gameState.currentLevel < levels.length) {
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

    // Random chance for jumpscare (30%)
    if (Math.random() < 0.3) {
      setShowJumpscare(true)
    }

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
    // Show jumpscare first!
    setShowJumpscare(true)

    // Play voice after a short delay (so jumpscare shows first)
    setTimeout(() => {
      playVoiceRecording('Astrid', 'wake', language)
    }, 300)

    setGameState(prev => ({ ...prev, astridAwake: true }))
  }, [language])

  const updateHideTimer = useCallback((time) => {
    setGameState(prev => {
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
          // Fade out music first, then play voice
          fadeOutMusic()
          setTimeout(() => {
            playVoiceRecording('Astrid', 'success', language)
          }, 500)
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
    if (gameState.currentLevel < levels.length) {
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
      <BloodSplatter show={showBloodSplatter} />
    </>
  )
}

export default App

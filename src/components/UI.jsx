import { useEffect } from 'react'
import { playDeathSound } from '../utils/sounds'
import { getTranslation } from '../translations'

function UI({ gameState, levels, language, onSelectLanguage, onStart, onRestart, onContinue }) {
  const currentLevel = levels[gameState.currentLevel - 1]
  const t = (key) => getTranslation(language || 'en', key)

  useEffect(() => {
    if (gameState.gameOver) {
      playDeathSound()
    }
  }, [gameState.gameOver])

  return (
    <div className="ui-overlay">
      {/* Language selection screen - shows first */}
      {!language && (
        <div className="start-screen">
          <h1>YELLOW HORROR HOSE</h1>
          <p style={{ fontSize: '24px', marginBottom: '40px' }}>
            {t('selectLanguage')}
          </p>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
            <button
              className="start-btn"
              onClick={() => onSelectLanguage('sv')}
              style={{ fontSize: '32px' }}
            >
              🇸🇪 SVENSKA
            </button>
            <button
              className="start-btn"
              onClick={() => onSelectLanguage('en')}
              style={{ fontSize: '32px' }}
            >
              🇬🇧 ENGLISH
            </button>
          </div>
        </div>
      )}

      {/* Start screen - shows after language selected */}
      {language && !gameState.isPlaying && !gameState.gameOver && !gameState.victory && (
        <div className="start-screen">
          <h1>{t('gameTitle')}</h1>
          <p>{t('gameDescription1')}</p>
          <p>{t('gameDescription2')}</p>
          <button className="start-btn" onClick={onStart}>
            {t('startButton')}
          </button>
        </div>
      )}

      {gameState.isPlaying && (
        <>
          <div className="game-hud">
            <div className="hud-item">
              {t('level')} {gameState.currentLevel}: {currentLevel.name}
            </div>

            {currentLevel.name === 'Astrid' && gameState.isInsideHouse ? (
              <>
                {!gameState.astridAwake ? (
                  <div className="hud-item">
                    {t('astridSleeping')}
                  </div>
                ) : (
                  <>
                    <div className="hud-item low-health">
                      {t('astridWaking')}
                    </div>
                    <div className={`hud-item ${gameState.hideTimer <= 5 ? 'low-health' : ''}`}>
                      {t('hideTimer')}: {Math.ceil(gameState.hideTimer)}s
                    </div>
                    <div className={`hud-item ${gameState.isHiding ? 'has-key' : ''}`}>
                      Status: {gameState.isHiding ? t('statusHidden') : t('statusVisible')}
                    </div>
                  </>
                )}
              </>
            ) : currentLevel.name === 'Astrid' && !gameState.isInsideHouse ? (
              <div className="hud-item">
                {t('enterHouseQuietly')}
              </div>
            ) : (
              <>
                <div className={`hud-item ${gameState.hasKey ? 'has-key' : ''}`}>
                  Key: {gameState.hasKey ? t('keyFound') : t('keyNotFound')}
                </div>
                <div className={`hud-item ${gameState.health <= 30 ? 'low-health' : ''}`}>
                  {t('health')}: {Math.round(gameState.health)}%
                </div>
              </>
            )}
          </div>
          <div className="instructions">
            {t('instructionsMove')} | {t('instructionsLook')}
            {currentLevel.name === 'Astrid' && gameState.isInsideHouse && ` | ${t('instructionsHide')}`}
          </div>
        </>
      )}

      {gameState.levelComplete && (
        <div className="victory-screen">
            <h2>
              {currentLevel.name === 'Molltas' && t('levelCompleteMolltas')}
              {currentLevel.name === 'Astrid' && t('levelCompleteAstrid')}
              {currentLevel.name === 'Selma' && t('levelCompleteSelma')}
              {currentLevel.name === 'Kerstin' && t('levelCompleteKerstin')}
              {currentLevel.name === 'Maria' && t('levelCompleteMaria')}
              {currentLevel.name === 'Pappa' && t('levelCompletePappa')}
            </h2>
            <p>
              {currentLevel.name === 'Molltas' && t('levelCompleteDescMolltas')}
              {currentLevel.name === 'Astrid' && t('levelCompleteDescAstrid')}
              {currentLevel.name === 'Selma' && t('levelCompleteDescSelma')}
              {currentLevel.name === 'Kerstin' && t('levelCompleteDescKerstin')}
              {currentLevel.name === 'Maria' && t('levelCompleteDescMaria')}
              {currentLevel.name === 'Pappa' && t('levelCompleteDescPappa')}
            </p>
            <p>{t('level')} {gameState.currentLevel} {t('levelCompleteWord')}</p>
            <button className="restart-btn" onClick={onContinue}>
              {gameState.currentLevel < levels.length ? t('continueButton') : t('seeVictoryButton')}
            </button>
          </div>
      )}

      {gameState.gameOver && (
        <div className="game-over-screen" style={{
          background: 'radial-gradient(circle, rgba(139,0,0,0.95) 0%, rgba(0,0,0,0.98) 100%)',
          animation: 'deathPulse 2s ease-in-out infinite'
        }}>
          <div style={{
            fontSize: '100px',
            marginBottom: '20px',
            animation: 'skullShake 0.5s ease-in-out infinite'
          }}>
            💀
          </div>
          <h2 style={{
            color: '#ff0000',
            textShadow: '0 0 20px #ff0000, 0 0 40px #8B0000',
            animation: 'fadeInOut 1.5s ease-in-out infinite',
            fontSize: '60px'
          }}>{t('gameOverTitle')}</h2>
          <p style={{ fontSize: '24px', color: '#ffaaaa' }}>
            {currentLevel.name} {t('gameOverCaught')}
          </p>
          <p style={{ fontSize: '20px', color: '#ffcccc' }}>
            {t('gameOverReached')} {gameState.currentLevel}
          </p>
          <button className="restart-btn" onClick={onRestart} style={{
            marginTop: '30px',
            padding: '15px 40px',
            fontSize: '24px'
          }}>
            {t('tryAgainButton')}
          </button>
          <style>{`
            @keyframes deathPulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.8; }
            }
            @keyframes skullShake {
              0%, 100% { transform: rotate(-5deg); }
              50% { transform: rotate(5deg); }
            }
            @keyframes fadeInOut {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.7; }
            }
          `}</style>
        </div>
      )}

      {gameState.victory && (
        <div className="victory-screen">
          <h2>{t('victoryTitle')}</h2>
          <p>{t('victoryDesc1')}</p>
          <p>{t('victoryDesc2')}</p>
          <button className="restart-btn" onClick={onRestart}>
            {t('playAgainButton')}
          </button>
        </div>
      )}
    </div>
  )
}

export default UI

import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Suspense, useState, useEffect, useCallback, useRef } from 'react'
import Player from './Player'
import House from './House'
import Ground from './Ground'
import Key from './Key'
import Character from './Character'
import Furniture from './Furniture'
import HouseInterior from './HouseInterior'
import Classroom from './Classroom'
import ClassroomNPCs from './ClassroomNPCs'
import ClassroomExit from './ClassroomExit'
import Candy, { CANDY_POSITIONS } from './Candy'

const CLASSROOM_START = [0, 1.6, 2]
const CLASSROOM_START_YAW = 0

function Game({
  gameState,
  level,
  language,
  onCollectKey,
  onNextLevel,
  onTakeDamage,
  onEnterHouse,
  onSetHiding,
  onWakeAstrid,
  onUpdateHideTimer,
  mobileMovement,
  mobileRotation
}) {
  const [nearFurniture, setNearFurniture] = useState({})
  const [candyPieces, setCandyPieces] = useState([])
  const candyTimerRef = useRef(null)

  const isAstridLevel = level.name === 'Astrid'
  const isKerstinLevel = level.name === 'Kerstin'
  const classroomIntroPhase = gameState.classroomIntroPhase
  const isIntroActive = false

  // Spawn candy 10s after level start (3s after shots fire at 7s)
  // Timer stored in ref so phase changes don't cancel it
  useEffect(() => {
    if (isKerstinLevel && classroomIntroPhase === 'shots' && candyPieces.length === 0 && !candyTimerRef.current) {
      candyTimerRef.current = setTimeout(() => {
        candyTimerRef.current = null
        setCandyPieces(CANDY_POSITIONS.map(p => ({ ...p, eaten: false, collectedByPlayer: false })))
      }, 3000)
    }
    if (!isKerstinLevel || classroomIntroPhase === null || classroomIntroPhase === 'seated') {
      clearTimeout(candyTimerRef.current)
      candyTimerRef.current = null
      setCandyPieces([])
    }
  }, [isKerstinLevel, classroomIntroPhase])

  // Fail if all candy eaten before player gets any
  useEffect(() => {
    if (candyPieces.length === 0) return
    const playerHas = candyPieces.some(p => p.collectedByPlayer)
    const anyLeft = candyPieces.some(p => !p.eaten && !p.collectedByPlayer)
    if (!anyLeft && !playerHas) {
      onTakeDamage(100)
    }
  }, [candyPieces, onTakeDamage])

  const handleCandyEaten = useCallback((id) => {
    setCandyPieces(prev => prev.map(p => p.id === id ? { ...p, eaten: true } : p))
  }, [])

  const handleCandyCollected = useCallback((id) => {
    setCandyPieces(prev => prev.map(p => p.id === id ? { ...p, collectedByPlayer: true } : p))
    onCollectKey()
  }, [onCollectKey])

  useEffect(() => {
    const isHidingInSafeSpot = nearFurniture.bed === true
    onSetHiding(isHidingInSafeSpot)
  }, [nearFurniture, onSetHiding])

  const handleFurnitureProximity = (furnitureId, isNear) => {
    setNearFurniture(prev => ({ ...prev, [furnitureId]: isNear }))
  }

  // Classroom level
  if (isKerstinLevel) {
    return (
      <Canvas shadows camera={{ fov: 75, position: CLASSROOM_START }}>
        <ambientLight intensity={0.5} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={0.6}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <fog attach="fog" args={['#ffe8d6', 15, 40]} />

        <Suspense fallback={null}>
          <Classroom />

          <ClassroomNPCs
            panicPhase={classroomIntroPhase}
            candyPieces={candyPieces}
            onCandyEaten={handleCandyEaten}
          />

          {candyPieces.length > 0 && !gameState.hasKey && (
            <Candy pieces={candyPieces} onCollectedByPlayer={handleCandyCollected} />
          )}

          {classroomIntroPhase === 'active' && (
            <Character
              level={level}
              onCatchPlayer={onTakeDamage}
              language={language}
              startPosition={[8.5, 1, 4]}
            />
          )}

          {classroomIntroPhase === 'active' && (
            <ClassroomExit hasKey={gameState.hasKey} onExit={onNextLevel} />
          )}

          <Player
            mobileMovement={mobileMovement}
            mobileRotation={mobileRotation}
            isLocked={isIntroActive}
            startPosition={CLASSROOM_START}
            startYaw={CLASSROOM_START_YAW}
            inClassroom={true}
          />
        </Suspense>
      </Canvas>
    )
  }

  // Outdoor levels
  return (
    <Canvas shadows camera={{ fov: 75, position: [0, 1.6, 15] }}>
      <Sky sunPosition={[100, -10, 100]} turbidity={10} rayleigh={0.5} />
      <ambientLight intensity={gameState.isInsideHouse ? 0.2 : 0.25} />
      <directionalLight
        position={[50, 50, 50]}
        intensity={gameState.isInsideHouse ? 0.3 : 0.35}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />
      <fog attach="fog" args={['#1a1a2e', 20, 80]} />

      <Suspense fallback={null}>
        <Ground />

        {isAstridLevel && gameState.isInsideHouse ? (
          <>
            <HouseInterior />
            <Furniture position={[-3, 0, -22]} type="sofa" onPlayerNear={(near) => handleFurnitureProximity('sofa', near)} />
            <Furniture position={[3, 0, -24]} type="bookshelf" onPlayerNear={(near) => handleFurnitureProximity('bookshelf', near)} />
            <Furniture position={[0, 0, -28]} type="table" onPlayerNear={(near) => handleFurnitureProximity('table', near)} />
            <Furniture position={[5, 0, -20]} type="bed" onPlayerNear={(near) => handleFurnitureProximity('bed', near)} />
            <Character
              level={level}
              onCatchPlayer={onTakeDamage}
              isAstridLevel={true}
              astridAwake={gameState.astridAwake}
              onWakeAstrid={onWakeAstrid}
              isPlayerHiding={gameState.isHiding}
              hideTimer={gameState.hideTimer}
              onUpdateHideTimer={onUpdateHideTimer}
              language={language}
            />
          </>
        ) : (
          <>
            <House
              onEnter={isAstridLevel ? onEnterHouse : onNextLevel}
              hasKey={gameState.hasKey}
              isAstridLevel={isAstridLevel}
            />
            {!gameState.hasKey && !isAstridLevel && <Key onCollect={onCollectKey} />}
            {!isAstridLevel && <Character level={level} onCatchPlayer={onTakeDamage} language={language} />}
            {isAstridLevel && (
              <Character
                level={level}
                onCatchPlayer={onTakeDamage}
                isAstridLevel={true}
                astridAwake={false}
                isSleeping={!gameState.isInsideHouse}
                language={language}
              />
            )}
          </>
        )}

        <Player mobileMovement={mobileMovement} mobileRotation={mobileRotation} />
      </Suspense>
    </Canvas>
  )
}

export default Game

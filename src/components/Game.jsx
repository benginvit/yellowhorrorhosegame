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
import Lighting from './Lighting'
import HorrorEffects from './HorrorEffects'
import Candy, { CANDY_POSITIONS } from './Candy'
import { CANVAS_DPR, CANVAS_GL, CANVAS_FRAMELOOP, TestModeProbe, onCanvasCreated, setTimer, clearTimer } from '../testMode'

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
      candyTimerRef.current = setTimer(() => {
        candyTimerRef.current = null
        setCandyPieces(CANDY_POSITIONS.map(p => ({ ...p, eaten: false, collectedByPlayer: false })))
      }, 3000)
    }
    if (!isKerstinLevel || classroomIntroPhase === null || classroomIntroPhase === 'seated') {
      clearTimer(candyTimerRef.current)
      candyTimerRef.current = null
      setCandyPieces([])
    }
  }, [isKerstinLevel, classroomIntroPhase])

  // Fail if all candy eaten before player gets any — only after Kerstin has entered
  useEffect(() => {
    if (candyPieces.length === 0) return
    if (classroomIntroPhase !== 'active') return
    const playerHas = candyPieces.some(p => p.collectedByPlayer)
    const anyLeft = candyPieces.some(p => !p.eaten && !p.collectedByPlayer)
    if (!anyLeft && !playerHas) {
      onTakeDamage(100)
    }
  }, [candyPieces, classroomIntroPhase, onTakeDamage])

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
      <Canvas
        shadows
        dpr={CANVAS_DPR}
        frameloop={CANVAS_FRAMELOOP}
        gl={CANVAS_GL}
        onCreated={onCanvasCreated}
        camera={{ fov: 75, position: CLASSROOM_START }}
      >
        <Lighting variant="classroom" />

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
              startPosition={[6, 1, 3]}
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
          <TestModeProbe />
        </Suspense>
        <HorrorEffects />
      </Canvas>
    )
  }

  // Outdoor levels
  return (
    <Canvas
      shadows
      dpr={CANVAS_DPR}
      frameloop={CANVAS_FRAMELOOP}
      gl={CANVAS_GL}
      onCreated={onCanvasCreated}
      camera={{ fov: 75, position: [0, 1.6, 15] }}
    >
      <Sky sunPosition={[100, -10, 100]} turbidity={10} rayleigh={0.5} />
      <Lighting variant={gameState.isInsideHouse && isAstridLevel ? 'houseInterior' : 'outdoor'} />

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
        <TestModeProbe />
      </Suspense>
      <HorrorEffects />
    </Canvas>
  )
}

export default Game

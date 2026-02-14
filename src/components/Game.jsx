import { Canvas } from '@react-three/fiber'
import { Sky } from '@react-three/drei'
import { Suspense, useState, useEffect } from 'react'
import Player from './Player'
import House from './House'
import Ground from './Ground'
import Key from './Key'
import Character from './Character'
import Furniture from './Furniture'
import HouseInterior from './HouseInterior'

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
  onUpdateHideTimer
}) {
  const [nearFurniture, setNearFurniture] = useState({})
  const isAstridLevel = level.name === 'Astrid'

  // Update hiding state when furniture proximity changes
  useEffect(() => {
    // ONLY the bed is a safe hiding spot! All other furniture is useless
    const isHidingInSafeSpot = nearFurniture.bed === true
    onSetHiding(isHidingInSafeSpot)
  }, [nearFurniture, onSetHiding])

  const handleFurnitureProximity = (furnitureId, isNear) => {
    setNearFurniture(prev => ({
      ...prev,
      [furnitureId]: isNear
    }))
  }

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

        {/* Astrid level - special gameplay */}
        {isAstridLevel && gameState.isInsideHouse ? (
          <>
            <HouseInterior />
            <Furniture
              position={[-3, 0, -22]}
              type="sofa"
              onPlayerNear={(near) => handleFurnitureProximity('sofa', near)}
            />
            <Furniture
              position={[3, 0, -24]}
              type="bookshelf"
              onPlayerNear={(near) => handleFurnitureProximity('bookshelf', near)}
            />
            <Furniture
              position={[0, 0, -28]}
              type="table"
              onPlayerNear={(near) => handleFurnitureProximity('table', near)}
            />
            <Furniture
              position={[5, 0, -20]}
              type="bed"
              onPlayerNear={(near) => handleFurnitureProximity('bed', near)}
            />
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
            {!isAstridLevel && (
              <Character level={level} onCatchPlayer={onTakeDamage} language={language} />
            )}
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

        <Player />
      </Suspense>
    </Canvas>
  )
}

export default Game

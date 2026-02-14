function HouseInterior() {
  return (
    <group position={[0, 0, -25]}>
      {/* Floor */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[14, 0.1, 14]} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>

      {/* Walls */}
      {/* Back wall */}
      <mesh position={[0, 4, -7]} receiveShadow>
        <boxGeometry args={[14, 8, 0.2]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Left wall */}
      <mesh position={[-7, 4, 0]} receiveShadow>
        <boxGeometry args={[0.2, 8, 14]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Right wall */}
      <mesh position={[7, 4, 0]} receiveShadow>
        <boxGeometry args={[0.2, 8, 14]} />
        <meshStandardMaterial color="#FFF8DC" />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 8, 0]} receiveShadow>
        <boxGeometry args={[14, 0.2, 14]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Lights */}
      <pointLight position={[0, 6, 0]} intensity={1} distance={20} color="#FFE4B5" />
      <pointLight position={[-4, 6, -4]} intensity={0.5} distance={15} color="#FFE4B5" />
      <pointLight position={[4, 6, -4]} intensity={0.5} distance={15} color="#FFE4B5" />

      {/* Ceiling lamp */}
      <mesh position={[0, 7, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.5} />
      </mesh>

      {/* Pictures on walls */}
      <mesh position={[0, 5, -6.9]} castShadow>
        <boxGeometry args={[1.5, 2, 0.1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      <mesh position={[-6.9, 5, -3]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <boxGeometry args={[1.5, 2, 0.1]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      {/* Rug */}
      <mesh position={[0, 0.11, -2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 3]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
    </group>
  )
}

export default HouseInterior

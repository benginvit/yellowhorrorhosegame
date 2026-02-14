function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0, 0]}>
      <planeGeometry args={[200, 200]} />
      <meshStandardMaterial color="#3a9c3e" />
    </mesh>
  )
}

export default Ground

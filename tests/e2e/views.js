// Fixed camera poses for the screenshot diffs (frozen, seed=1).
// level 1 = outdoors with the house (z = -25), level 3 = classroom ("seated" intro phase).
// yaw: radians, + = turn left (0 = facing -z).
export const VIEWS = [
  { name: 'house-front', level: 1, x: 0, z: 15, yaw: 0 },
  { name: 'house-corner', level: 1, x: -22, z: -2, yaw: -0.8 },
  { name: 'house-door', level: 1, x: 0, z: -6, yaw: 0 },
  { name: 'classroom-start', level: 3, x: 0, z: 2, yaw: 0 },
  { name: 'classroom-left', level: 3, x: -6, z: 4, yaw: -0.5 },
]

import { EffectComposer, Bloom, ChromaticAberration, HueSaturation, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Vector2 } from 'three'
import { CANVAS_FRAMELOOP } from '../testMode'

// All tweakable post-processing parameters live here.
export const HORROR_FX = {
  // MSAA samples for the composer's render target (the canvas' own MSAA is
  // bypassed once rendering goes through the composer).
  multisampling: 4,

  bloom: {
    // Only fairly bright pixels bloom (yellow/emissive light sources); the
    // dim, foggy scenes stay clean.
    luminanceThreshold: 0.75,
    luminanceSmoothing: 0.2,
    intensity: 0.9,
    mipmapBlur: true,
  },

  // Subtle RGB split towards the screen edges.
  chromaticAberration: {
    offset: [0.0007, 0.0007],
    radialModulation: true,
    modulationOffset: 0.3,
  },

  // saturation: -1..1, negative = desaturated. hue in radians.
  hueSaturation: { hue: 0, saturation: -0.3 },

  toneMapping: { mode: ToneMappingMode.ACES_FILMIC },

  vignette: { offset: 0.3, darkness: 0.75 },

  // Film grain. Low opacity; soft-light so it does not lift the blacks.
  noise: { opacity: 0.25, blendFunction: BlendFunction.SOFT_LIGHT },
}

// With ?freeze=1 in the test build (frameloop 'never') the grain is dropped
// entirely so screenshots are stable regardless of the noise shader's clock.
const GRAIN_ENABLED = CANVAS_FRAMELOOP !== 'never'

const CA_OFFSET = new Vector2(...HORROR_FX.chromaticAberration.offset)

/** Shared by every <Canvas> in Game.jsx. Render as the last child of the Canvas. */
export default function HorrorEffects() {
  const { bloom, chromaticAberration, hueSaturation, toneMapping, vignette, noise } = HORROR_FX

  return (
    <EffectComposer multisampling={HORROR_FX.multisampling} disableNormalPass>
      <Bloom {...bloom} />
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation={chromaticAberration.radialModulation}
        modulationOffset={chromaticAberration.modulationOffset}
      />
      <HueSaturation {...hueSaturation} />
      <ToneMapping {...toneMapping} />
      <Vignette {...vignette} />
      {GRAIN_ENABLED && <Noise {...noise} />}
    </EffectComposer>
  )
}

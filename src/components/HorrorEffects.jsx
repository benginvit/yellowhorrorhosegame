import { EffectComposer, Bloom, BrightnessContrast, ChromaticAberration, HueSaturation, Noise, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, ToneMappingMode } from 'postprocessing'
import { Vector2 } from 'three'

// All tweakable post-processing parameters live here.
export const HORROR_FX = {
  // MSAA samples for the composer's render target (the canvas' own MSAA is
  // bypassed once rendering goes through the composer).
  multisampling: 4,

  bloom: {
    // Luminance threshold on the linear HDR frame, so it cannot tell yellow
    // from white: anything brighter than this blooms. White fluorescent tubes
    // (L ~ 9-10) still bloom fully; the dim yellow ceiling lamp (L ~ 0.5) does
    // not bloom at all. Only mid-bright surfaces stopped blooming vs 0.75.
    luminanceThreshold: 0.9,
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
  hueSaturation: { hue: 0, saturation: -0.5 },

  toneMapping: { mode: ToneMappingMode.ACES_FILMIC },

  vignette: { offset: 0.3, darkness: 0.75 },

  // Film grain. Low opacity; soft-light so it does not lift the blacks.
  noise: { opacity: 0.25, blendFunction: BlendFunction.SOFT_LIGHT },

  // Last in the chain. Net effect: black is lifted by ~+4/255, highlights are
  // lifted the most, and everything above ~239/255 is clipped to white. Moving
  // it earlier in the chain changes the look.
  brightnessContrast: { brightness: 0.04, contrast: 0.05 },
}

const CA_OFFSET = new Vector2(...HORROR_FX.chromaticAberration.offset)

/**
 * Shared by every <Canvas> in Game.jsx. Render as the last child of the Canvas.
 *
 * Post-FX is bypassed in the test build (VITE_TEST_MODE=1, decided at build
 * time): the EffectComposer chain is ~10x slower under SwiftShader, which breaks
 * frame-time budgets and screenshot timeouts. E2E screenshots and perf numbers
 * therefore show the scene WITHOUT post-FX. Prod always renders the composer.
 */
export default function HorrorEffects() {
  if (import.meta.env.VITE_TEST_MODE === '1') return null

  const { bloom, chromaticAberration, hueSaturation, toneMapping, vignette, noise, brightnessContrast } = HORROR_FX

  return (
    <EffectComposer multisampling={HORROR_FX.multisampling}>
      <Bloom {...bloom} />
      <ChromaticAberration
        offset={CA_OFFSET}
        radialModulation={chromaticAberration.radialModulation}
        modulationOffset={chromaticAberration.modulationOffset}
      />
      <HueSaturation {...hueSaturation} />
      <ToneMapping {...toneMapping} />
      <Vignette {...vignette} />
      <Noise {...noise} />
      <BrightnessContrast {...brightnessContrast} />
    </EffectComposer>
  )
}

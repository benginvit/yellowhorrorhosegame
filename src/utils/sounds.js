// Sound effects using Web Audio API
let audioContext = null

const getAudioContext = () => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)()
  }
  // Resume context if suspended (browser security requirement)
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

// Track all active voice recording audio elements
let activeVoiceAudios = []

// Cache for preloaded audio elements
let preloadedAudio = {}

// Initialize audio context on user interaction
export const initAudio = () => {
  const ctx = getAudioContext()
  if (ctx.state === 'suspended') {
    ctx.resume()
  }
  return ctx
}

// Preload audio files for a specific language
export const preloadAudioFiles = (language = 'sv') => {
  console.log(`🔊 Preloading audio files for language: ${language}`)

  // List of audio files to preload
  const filesToPreload = [
    { character: 'Astrid', actions: ['wake', 'failed', 'success', 'snoring'] },
    { character: 'Molltas', actions: ['meow'] }
  ]

  preloadedAudio = {}

  filesToPreload.forEach(({ character, actions }) => {
    actions.forEach(action => {
      const fileName = `${character.toLowerCase()}-${action}.m4a`
      const audioPath = `/sounds/${language}/${fileName}`
      const cacheKey = `${character}-${action}-${language}`

      try {
        const audio = new Audio()
        audio.preload = 'auto'
        audio.src = audioPath
        audio.volume = 0.7

        // Store in cache
        preloadedAudio[cacheKey] = audio

        // Load the audio
        audio.load()

        console.log(`✅ Preloaded: ${audioPath}`)
      } catch {
        console.log(`⚠️ Failed to preload: ${audioPath}`)
      }
    })
  })
}

// Play custom voice recording (uses preloaded audio if available)
export const playVoiceRecording = (characterName, action, language = 'en') => {
  const cacheKey = `${characterName}-${action}-${language}`

  console.log(`🎤 Attempting to play voice: ${cacheKey}`)

  // Try to use preloaded audio first
  if (preloadedAudio[cacheKey]) {
    const preloadedElement = preloadedAudio[cacheKey]

    console.log(`📦 Preloaded audio found for ${cacheKey}`)
    console.log(`   - src: ${preloadedElement.src}`)
    console.log(`   - readyState: ${preloadedElement.readyState} (4=HAVE_ENOUGH_DATA)`)
    console.log(`   - paused: ${preloadedElement.paused}`)
    console.log(`   - ended: ${preloadedElement.ended}`)
    console.log(`   - error: ${preloadedElement.error}`)

    // Check if the preloaded audio is currently playing
    const isPlaying = !preloadedElement.paused && !preloadedElement.ended

    let audio
    if (isPlaying) {
      console.log(`⚠️  Audio is already playing, creating new instance`)
      // Create a new instance from the cached source if already playing
      audio = new Audio(preloadedElement.src)
      audio.volume = 0.7
      audio.preload = 'auto'

      // Wait for the audio to be ready before playing
      audio.addEventListener('canplaythrough', () => {
        audio.play().catch((error) => {
          console.log(`❌ Failed to play new audio instance: ${cacheKey}`)
          console.log(`   Error: ${error.name} - ${error.message}`)
          playFallbackSound(action)
        })
      }, { once: true })

      // Track this audio element
      activeVoiceAudios.push(audio)

      // Remove from tracking when it finishes playing
      const handleEnded = () => {
        const index = activeVoiceAudios.indexOf(audio)
        if (index > -1) {
          activeVoiceAudios.splice(index, 1)
        }
        audio.removeEventListener('ended', handleEnded)
      }
      audio.addEventListener('ended', handleEnded)

      // Return early - play will happen in the canplaythrough handler
      return audio
    } else {
      console.log(`♻️  Reusing preloaded audio element`)
      // Reuse the preloaded element if not playing
      audio = preloadedElement
      try {
        audio.currentTime = 0
      } catch (e) {
        console.log(`⚠️  Could not reset currentTime:`, e)
      }
      audio.volume = 0.7
    }

    // Track this audio element
    activeVoiceAudios.push(audio)

    // Remove from tracking when it finishes playing
    const handleEnded = () => {
      const index = activeVoiceAudios.indexOf(audio)
      if (index > -1) {
        activeVoiceAudios.splice(index, 1)
      }
      audio.removeEventListener('ended', handleEnded)
    }
    audio.addEventListener('ended', handleEnded)

    // Play the audio
    console.log(`▶️  Calling audio.play()...`)
    const playPromise = audio.play()

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`✅ Successfully playing: ${cacheKey}`)
        })
        .catch((error) => {
          console.log(`❌ Failed to play preloaded voice: ${cacheKey}`)
          console.log(`   Error name: ${error.name}`)
          console.log(`   Error message: ${error.message}`)
          console.log(`   Audio context state: ${getAudioContext().state}`)
          // Remove from tracking if it failed to play
          const index = activeVoiceAudios.indexOf(audio)
          if (index > -1) {
            activeVoiceAudios.splice(index, 1)
          }
          playFallbackSound(action)
        })
    }

    return audio
  }

  // Fallback to creating new audio element
  const fileName = `${characterName.toLowerCase()}-${action}.m4a`
  const audioPath = `/sounds/${language}/${fileName}`

  const audio = new Audio(audioPath)
  audio.volume = 0.7

  // Track this audio element
  activeVoiceAudios.push(audio)

  // Remove from tracking when it finishes playing
  audio.addEventListener('ended', () => {
    const index = activeVoiceAudios.indexOf(audio)
    if (index > -1) {
      activeVoiceAudios.splice(index, 1)
    }
  })

  audio.play().catch(err => {
    console.log(`Could not play custom voice: ${audioPath}, using fallback sound`)
    // Remove from tracking if it failed to play
    const index = activeVoiceAudios.indexOf(audio)
    if (index > -1) {
      activeVoiceAudios.splice(index, 1)
    }
    playFallbackSound(action)
  })

  return audio
}

// Play fallback sound based on action
function playFallbackSound(action) {
  if (action === 'wake') {
    playJumpscareSound()
  } else if (action === 'catch') {
    playHitSound()
  } else if (action === 'failed') {
    playHitSound() // "Nu ska du få!"
  } else if (action === 'success') {
    // No fallback sound for success - just silent if missing
    console.log('Success voice not found, continuing silently')
  }
}

// Scary hit sound effect
export const playHitSound = () => {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // Create oscillators for a dissonant, scary sound
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc1.connect(gainNode)
  osc2.connect(gainNode)
  gainNode.connect(ctx.destination)

  // Dissonant frequencies
  osc1.frequency.setValueAtTime(150, now)
  osc1.frequency.exponentialRampToValueAtTime(50, now + 0.3)

  osc2.frequency.setValueAtTime(157, now) // Slightly off for dissonance
  osc2.frequency.exponentialRampToValueAtTime(53, now + 0.3)

  // Envelope - LOUDER
  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(0.8, now + 0.01)
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3)

  osc1.start(now)
  osc2.start(now)
  osc1.stop(now + 0.3)
  osc2.stop(now + 0.3)
}

// Jumpscare sound - loud and sudden
export const playJumpscareSound = () => {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  // White noise for scream-like effect
  const bufferSize = ctx.sampleRate * 0.5
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }

  const noise = ctx.createBufferSource()
  noise.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1000

  const gainNode = ctx.createGain()

  noise.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(ctx.destination)

  // Loud attack - MUCH LOUDER
  gainNode.gain.setValueAtTime(1.0, now)
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5)

  noise.start(now)
  noise.stop(now + 0.5)
}

// Death sound - low ominous tone
export const playDeathSound = () => {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc.frequency.setValueAtTime(80, now)
  osc.frequency.exponentialRampToValueAtTime(40, now + 1.5)

  gainNode.gain.setValueAtTime(0, now)
  gainNode.gain.linearRampToValueAtTime(0.5, now + 0.1)
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 1.5)

  osc.start(now)
  osc.stop(now + 1.5)
}

// Horror background music with fallback
let backgroundMusic = null
let musicOscillators = []
let musicInterval = null

const stopGeneratedMusic = () => {
  if (musicInterval) {
    clearInterval(musicInterval)
    musicInterval = null
  }
  musicOscillators.forEach(osc => {
    try {
      osc.stop()
    } catch (e) {
      // Already stopped
    }
  })
  musicOscillators = []
}

const playGeneratedHorrorMusic = (isIntense = false, isCalm = false) => {
  const ctx = getAudioContext()

  // Different melodies for different modes
  let scaryMelody
  let tempo

  if (isCalm) {
    // Very calm, sparse, low notes for sleeping Astrid
    scaryMelody = [
      220.00, // A3 - very low
      246.94, // B3
      196.00, // G3
      174.61, // F3
      220.00, // A3
    ]
    tempo = 1200 // Very slow
  } else if (isIntense) {
    // Faster, more frantic melody
    scaryMelody = [
      880.00, // A5
      830.61, // G#5
      783.99, // G5
      739.99, // F#5
      880.00, // A5
      783.99, // G5
      698.46, // F5
      659.25, // E5
      739.99, // F#5
      783.99, // G5
      830.61, // G#5
      880.00, // A5
    ]
    tempo = 400 // Fast tempo
  } else {
    // Original slower melody
    scaryMelody = [
      659.25, // E5
      622.25, // D#5
      587.33, // D5
      493.88, // B4
      659.25, // E5
      587.33, // D5
      523.25, // C5
      493.88, // B4
      440.00, // A4
      493.88, // B4
      523.25, // C5
      587.33, // D5
      523.25, // C5
      493.88, // B4
      440.00, // A4
      329.63, // E4
    ]
    tempo = 600 // Medium tempo
  }

  let noteIndex = 0

  const playMelodyNote = () => {
    const now = ctx.currentTime

    // Main melody oscillator
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    // Reverb-like effect with filter
    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = isIntense ? 3000 : 2000
    filter.Q.value = 1

    osc.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    // Use sine wave for music box sound
    osc.type = 'sine'
    osc.frequency.value = scaryMelody[noteIndex]

    // Add slight detune for eeriness (more for intense)
    osc.detune.value = Math.random() * (isIntense ? 20 : 10) - (isIntense ? 10 : 5)

    // Note envelope - quicker for intense mode
    const decayTime = isIntense ? 0.5 : 0.8
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(isIntense ? 0.18 : 0.15, now + 0.02)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + decayTime)

    osc.start(now)
    osc.stop(now + decayTime)

    musicOscillators.push(osc)

    // Move to next note
    noteIndex = (noteIndex + 1) % scaryMelody.length
  }

  // Play first note immediately
  playMelodyNote()

  // Play notes at specified tempo
  musicInterval = setInterval(playMelodyNote, tempo)
}

export const createHorrorMusic = (currentLevel = 1, astridAwake = false) => {
  // Stop any existing music
  if (backgroundMusic) {
    backgroundMusic.pause()
    backgroundMusic = null
  }
  stopGeneratedMusic()

  const isAstridLevel = currentLevel === 2
  const isAstridSleeping = isAstridLevel && !astridAwake

  // Use generated music with different styles for sleeping vs awake
  if (isAstridSleeping) {
    console.log(`🎵 Playing CALM ambient music (Level ${currentLevel}, Astrid sleeping)`)
    // Very calm, slow, sparse melody for sleeping Astrid
    playGeneratedHorrorMusic(false, true) // false = not intense, true = calm mode
  } else if (isAstridLevel) {
    console.log(`🔥 Playing INTENSE horror music (Level ${currentLevel}, Astrid awake)`)
    // Intense, fast, scary music when Astrid is awake
    playGeneratedHorrorMusic(true) // true = intense
  } else {
    console.log(`🎵 Playing regular horror music (Level ${currentLevel})`)
    // Regular horror music for other levels
    playGeneratedHorrorMusic(false)
  }

  return () => {
    if (backgroundMusic) {
      backgroundMusic.pause()
      backgroundMusic = null
    }
    stopGeneratedMusic()
  }
}

// Tick sound for timer countdown
export const playTickSound = (isUrgent = false) => {
  const ctx = getAudioContext()
  const now = ctx.currentTime

  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()

  osc.connect(gainNode)
  gainNode.connect(ctx.destination)

  osc.type = 'sine'
  osc.frequency.value = isUrgent ? 1200 : 800 // Higher pitch when urgent

  const volume = isUrgent ? 0.35 : 0.2 // Louder when urgent
  gainNode.gain.setValueAtTime(volume, now)
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05)

  osc.start(now)
  osc.stop(now + 0.05)
}

// Fade out music when level complete
export const fadeOutMusic = () => {
  if (backgroundMusic) {
    const fadeTime = 2 // 2 seconds fade out
    const startVolume = backgroundMusic.volume
    const fadeStep = startVolume / (fadeTime * 20) // 20 steps per second

    const fadeInterval = setInterval(() => {
      if (backgroundMusic && backgroundMusic.volume > 0.05) {
        backgroundMusic.volume = Math.max(0, backgroundMusic.volume - fadeStep)
      } else {
        if (backgroundMusic) {
          backgroundMusic.pause()
          backgroundMusic = null
        }
        clearInterval(fadeInterval)
      }
    }, 50)
  }

  // Also fade out generated music
  stopGeneratedMusic()
}

// Cat meow sound - tries custom recording first, then fallback to synthesized
export const playCatMeow = (language = 'en') => {
  // Try to play custom cat recording first
  const audio = new Audio(`/sounds/${language}/molltas-meow.m4a`)
  audio.volume = 0.5

  // Track this audio element
  activeVoiceAudios.push(audio)

  // Remove from tracking when it finishes playing
  audio.addEventListener('ended', () => {
    const index = activeVoiceAudios.indexOf(audio)
    if (index > -1) {
      activeVoiceAudios.splice(index, 1)
    }
  })

  audio.play().catch(() => {
    // Remove from tracking if it failed to play
    const index = activeVoiceAudios.indexOf(audio)
    if (index > -1) {
      activeVoiceAudios.splice(index, 1)
    }

    // Fallback to synthesized meow if no custom recording
    const ctx = getAudioContext()
    const now = ctx.currentTime

    // Create a meow-like sound with frequency sweep
    const osc = ctx.createOscillator()
    const gainNode = ctx.createGain()

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1500
    filter.Q.value = 3

    osc.connect(filter)
    filter.connect(gainNode)
    gainNode.connect(ctx.destination)

    osc.type = 'sawtooth'

    // Random pitch variation for different meows
    const basePitch = 400 + Math.random() * 200
    osc.frequency.setValueAtTime(basePitch, now)
    osc.frequency.linearRampToValueAtTime(basePitch * 1.5, now + 0.1)
    osc.frequency.linearRampToValueAtTime(basePitch * 0.8, now + 0.3)

    // Meow envelope
    gainNode.gain.setValueAtTime(0, now)
    gainNode.gain.linearRampToValueAtTime(0.15, now + 0.05)
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.15)
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.35)

    osc.start(now)
    osc.stop(now + 0.35)
  })
}

// Snoring sound for sleeping Astrid
let snoringInterval = null
let snoringAudio = null

export const startSnoring = (language = 'en') => {
  // Don't start if already snoring (either custom audio or synthesized)
  if (snoringInterval || snoringAudio) return

  // Try to use custom snoring recording
  const tryCustomSnoring = () => {
    const audio = new Audio(`/sounds/${language}/astrid-snoring.m4a`)
    audio.volume = 0.5
    audio.loop = true // Loop the snoring

    // Track this audio element
    activeVoiceAudios.push(audio)
    snoringAudio = audio

    audio.play().catch(() => {
      // Remove from tracking if custom recording not found
      const index = activeVoiceAudios.indexOf(audio)
      if (index > -1) {
        activeVoiceAudios.splice(index, 1)
      }
      snoringAudio = null

      // Fallback to synthesized snoring
      useSynthesizedSnoring()
    })
  }

  const useSynthesizedSnoring = () => {
    const playSnore = () => {
      const ctx = getAudioContext()
      const now = ctx.currentTime

      // Create snoring sound - low rumble
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gainNode = ctx.createGain()

      osc1.connect(gainNode)
      osc2.connect(gainNode)
      gainNode.connect(ctx.destination)

      osc1.type = 'sine'
      osc2.type = 'sine'

      // Low frequency snore
      osc1.frequency.setValueAtTime(80, now)
      osc1.frequency.linearRampToValueAtTime(85, now + 0.8)
      osc1.frequency.linearRampToValueAtTime(75, now + 1.5)

      osc2.frequency.setValueAtTime(120, now)
      osc2.frequency.linearRampToValueAtTime(125, now + 0.8)
      osc2.frequency.linearRampToValueAtTime(115, now + 1.5)

      // Snore envelope - in and out breathing
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(0.08, now + 0.7)
      gainNode.gain.linearRampToValueAtTime(0.04, now + 1.2)
      gainNode.gain.linearRampToValueAtTime(0, now + 1.5)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 1.5)
      osc2.stop(now + 1.5)
    }

    // Play first snore immediately
    playSnore()

    // Continue snoring every 2.5 seconds
    snoringInterval = setInterval(playSnore, 2500)
  }

  // Try custom recording first
  tryCustomSnoring()
}

export const stopSnoring = () => {
  // Stop custom snoring audio if playing
  if (snoringAudio) {
    try {
      snoringAudio.pause()
      snoringAudio.currentTime = 0
      snoringAudio.loop = false // Ensure it doesn't restart
      // Remove from tracking
      const index = activeVoiceAudios.indexOf(snoringAudio)
      if (index > -1) {
        activeVoiceAudios.splice(index, 1)
      }
    } catch (e) {
      // Already stopped or error
      console.log('Error stopping snoring audio:', e)
    }
    snoringAudio = null
  }

  // Stop synthesized snoring interval
  if (snoringInterval) {
    clearInterval(snoringInterval)
    snoringInterval = null
  }
}

// Stop all voice recordings (cat meows, voices, etc.) but keep music playing
export const stopVoiceRecordings = () => {
  // Stop all voice recording audio elements
  activeVoiceAudios.forEach(audio => {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch (e) {
      // Already stopped or error
    }
  })
  activeVoiceAudios = []

  // Stop snoring
  stopSnoring()
}

export const stopAllSounds = () => {
  // Stop all voice recording audio elements
  activeVoiceAudios.forEach(audio => {
    try {
      audio.pause()
      audio.currentTime = 0
    } catch (e) {
      // Already stopped or error
    }
  })
  activeVoiceAudios = []

  // Stop background music
  if (backgroundMusic) {
    backgroundMusic.pause()
    backgroundMusic = null
  }

  // Stop generated music
  stopGeneratedMusic()

  // Stop snoring
  stopSnoring()

  // Close audio context
  if (audioContext) {
    audioContext.close()
    audioContext = null
  }
}

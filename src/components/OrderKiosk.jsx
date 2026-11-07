import { useEffect, useState } from 'react'
import { Html } from '@react-three/drei'
import { createRand, setTimer, clearTimer } from '../testMode'
import { getTranslation } from '../translations'

// Mounted in <body> so the buttons sit above the canvas wrapper and the mobile controls.
const bodyPortal = { current: document.body }
// Stacking contract (z-index, see index.css): mobile controls 900 < .ui-overlay 1000
// (HUD, instructions, victory and game-over screens). While the order is in progress
// the kiosk sits ABOVE the UI overlay (KIOSK_Z_ORDERING, as before: the instructions
// text must not draw over the panel, and nothing in the overlay is clickable then).
// Once the order is done ('won') it drops BELOW the overlay (KIOSK_Z_DONE), so the
// victory screen that follows always gets the click: on top, the "order done" panel
// intercepted it whenever the two overlapped (BENG-91).
const KIOSK_Z_ORDERING = [100000, 50000]
const KIOSK_Z_DONE = [950, 901]
const overlay = { pointerEvents: 'none' }
const lookBackButton = { position: 'absolute', left: '50%', bottom: '3%', transform: 'translateX(-50%)', pointerEvents: 'auto' }
const panelStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 'min(92vw, 520px)',
  maxHeight: '80vh',
  overflowY: 'auto',
  boxSizing: 'border-box',
  padding: '16px',
  background: '#0b3d91',
  border: '6px solid #ffda1a',
  borderRadius: '14px',
  color: '#fff',
  textAlign: 'center',
  pointerEvents: 'auto',
  fontFamily: 'sans-serif',
}
// "Order done" is informational: it must never catch clicks meant for what is drawn on top of it.
const donePanelStyle = { ...panelStyle, pointerEvents: 'none' }
const bigButton = { display: 'block', width: '100%', margin: '8px 0', padding: '16px', fontSize: '22px', touchAction: 'manipulation' }
const smallButton = { ...bigButton, width: 'auto', display: 'inline-block', margin: '8px', padding: '12px 22px' }
const disabledButton = { opacity: 0.4, cursor: 'not-allowed' }
const title = { margin: '4px 0 10px', fontSize: '24px', color: '#ffda1a' }

const STREAM_ID = 0x6b696f73 // 'kios'
const TARGET_QTY = 16
const START_QTY = 4
const MAX_QTY = 40
const LOADING_MS = 1500
const INTERRUPTS = ['sausage', 'family', 'loading']

// Fisher-Yates with an independent stream: deterministic order with ?seed in test builds.
function shuffled(list) {
  const rand = createRand(STREAM_ID)
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const CATEGORIES = ['main', 'drinks', 'desserts']
const DISHES = ['meatballs', 'salmon', 'veggie', 'chicken', 'hotdog']
const SIDES = ['mash', 'fries', 'rice']

/**
 * The ordering kiosk's clickable DOM overlay (works on mobile). The 3D kiosk itself lives in IkeaStore.jsx.
 *
 * @param {object} props
 * @param {string|null} props.ikeaPhase  interactive in 'ordering'
 * @param {boolean} [props.orderDone]  show the "order done" panel (App: 'serve' until the player picks up the tray)
 * @param {number} props.ikeaTimeLeft  seconds left (0..IKEA_ORDER_SECONDS)
 * @param {boolean} props.lookingBack  the player is looking back at Rasmus: the kiosk is hidden (the countdown is not paused)
 * @param {'sv'|'en'} props.language
 * @param {() => void} props.onOrderComplete  call once the order is paid (App sets phase 'serve')
 * @param {(looking: boolean) => void} props.onLookBack  toggle looking back (also held with Space)
 *
 * Flow: start -> category -> dish -> quantity (exactly 16) -> side (mash) -> 3 interruptions
 * (sausage upsell, IKEA Family, loading; shuffled) -> cart -> pay. A wrong choice shows an error with a back button.
 * Test hooks (data-testid): ikea-start, ikea-category-{main,drinks,desserts}, ikea-dish-{meatballs,...},
 * ikea-qty-{minus,plus,value,next}, ikea-side-{mash,fries,rice}, ikea-sausage-{yes,no}, ikea-family-{yes,no},
 * ikea-family-scan, ikea-loading, ikea-cart, ikea-cart-remove-sausage, ikea-pay (final "pay"), ikea-error,
 * ikea-back, ikea-done, ikea-look-back (toggle; Space holds).
 */
function OrderKiosk({ ikeaPhase, orderDone = false, lookingBack, language = 'sv', onOrderComplete, onLookBack }) {
  const ordering = ikeaPhase === 'ordering'
  const t = (key) => getTranslation(language, key)

  const [step, setStep] = useState('start')
  const [error, setError] = useState(null) // { message, back } while a wrong choice is shown
  const [qty, setQty] = useState(START_QTY)
  const [sausage, setSausage] = useState(false)
  const [queue] = useState(() => shuffled(INTERRUPTS))
  const [queueIndex, setQueueIndex] = useState(0)

  const wrong = (message, back) => setError({ message, back })
  const goBack = () => {
    setStep(error.back)
    setError(null)
  }
  const nextInterrupt = () => {
    const i = queueIndex + 1
    setQueueIndex(i)
    setStep(i < queue.length ? queue[i] : 'cart')
  }

  // "Loading..." interruption: moves on by itself (frozen-test-clock aware).
  useEffect(() => {
    if (step !== 'loading' || !ordering) return undefined
    const id = setTimer(nextInterrupt, LOADING_MS)
    return () => clearTimer(id)
  }, [step, ordering])

  // Space = look back while held. Held key, not a toggle, so releasing returns to the kiosk.
  useEffect(() => {
    if (!ordering) return undefined
    const down = (e) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      if (!e.repeat) onLookBack(true)
    }
    const up = (e) => {
      if (e.code !== 'Space') return
      e.preventDefault()
      onLookBack(false)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [ordering, onLookBack])

  // drei only sets the wrapper's z-index (within zIndexRange) once the projected position changes, which
  // never happens for a fixed kiosk (and not at all on a frozen clock): set it from a marker element
  // instead, keyed on the phase so it is applied again when the range changes. Relies on drei Html's DOM
  // structure: wrapper > inner div (styles) > children. Re-check it when upgrading drei.
  const zRange = ordering ? KIOSK_Z_ORDERING : KIOSK_Z_DONE
  const raiseWrapper = (el) => {
    if (el) el.parentElement.parentElement.style.zIndex = String(zRange[0])
  }

  const btn = (testId, label, onClick, { disabled = false, small = false } = {}) => (
    <button
      data-testid={testId}
      className="restart-btn"
      style={{ ...(small ? smallButton : bigButton), ...(disabled ? disabledButton : null) }}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  )

  const renderStep = () => {
    if (error) {
      return (
        <>
          <h2 style={title} data-testid="ikea-error">{error.message}</h2>
          {btn('ikea-back', t('ikeaBack'), goBack)}
        </>
      )
    }
    switch (step) {
      case 'start':
        return btn('ikea-start', t('ikeaTouchToOrder'), () => setStep('category'))
      case 'category':
        return (
          <>
            <h2 style={title}>{t('ikeaCategories')}</h2>
            {CATEGORIES.map((c) =>
              btn(`ikea-category-${c}`, t(`ikeaCategory_${c}`), () =>
                c === 'main' ? setStep('dish') : wrong(t('ikeaWrongCategory'), 'category')
              )
            )}
          </>
        )
      case 'dish':
        return (
          <>
            <h2 style={title}>{t('ikeaCategory_main')}</h2>
            {DISHES.map((d) =>
              btn(`ikea-dish-${d}`, t(`ikeaDish_${d}`), () =>
                d === 'meatballs' ? setStep('qty') : wrong(t('ikeaWrongDish'), 'dish')
              )
            )}
          </>
        )
      case 'qty':
        return (
          <>
            <h2 style={title}>{t('ikeaDish_meatballs')}</h2>
            <div style={{ fontSize: '20px' }}>{t('ikeaHowMany')}</div>
            <div>
              {btn('ikea-qty-minus', '−', () => setQty((q) => Math.max(1, q - 1)), { small: true })}
              <span data-testid="ikea-qty-value" style={{ fontSize: '40px', fontWeight: 'bold', display: 'inline-block', minWidth: '70px' }}>{qty}</span>
              {btn('ikea-qty-plus', '+', () => setQty((q) => Math.min(MAX_QTY, q + 1)), { small: true })}
            </div>
            {btn('ikea-qty-next', t('ikeaNext'), () => setStep('side'), { disabled: qty !== TARGET_QTY })}
          </>
        )
      case 'side':
        return (
          <>
            <h2 style={title}>{t('ikeaSides')}</h2>
            {SIDES.map((s) =>
              btn(`ikea-side-${s}`, t(`ikeaSide_${s}`), () =>
                s === 'mash' ? (setQueueIndex(0), setStep(queue[0])) : wrong(t('ikeaWrongSide'), 'side')
              )
            )}
          </>
        )
      case 'sausage':
        return (
          <>
            <h2 style={title}>{t('ikeaSausageOffer')}</h2>
            {btn('ikea-sausage-yes', t('ikeaYes'), () => { setSausage(true); nextInterrupt() }, { small: true })}
            {btn('ikea-sausage-no', t('ikeaNo'), nextInterrupt, { small: true })}
          </>
        )
      case 'family':
        return (
          <>
            <h2 style={title}>{t('ikeaFamilyQuestion')}</h2>
            {btn('ikea-family-yes', t('ikeaYes'), () => setStep('familyScan'), { small: true })}
            {btn('ikea-family-no', t('ikeaNo'), nextInterrupt, { small: true })}
          </>
        )
      case 'familyScan':
        return (
          <>
            <h2 style={title}>{t('ikeaFamilyScan')}</h2>
            {btn('ikea-family-scan', t('ikeaScanCard'), nextInterrupt)}
          </>
        )
      case 'loading':
        return <h2 style={title} data-testid="ikea-loading">{t('ikeaLoading')}</h2>
      case 'cart':
        return (
          <div data-testid="ikea-cart">
            <h2 style={title}>{t('ikeaCart')}</h2>
            <div style={{ fontSize: '20px', textAlign: 'left' }}>
              <div>{qty} × {t('ikeaDish_meatballs')}</div>
              <div>{t('ikeaSide_mash')}</div>
              {sausage && <div>1 × {t('ikeaSausage')} (10 kr)</div>}
            </div>
            {sausage && btn('ikea-cart-remove-sausage', t('ikeaRemoveSausage'), () => setSausage(false))}
            {btn('ikea-pay', t('ikeaPay'), onOrderComplete, { disabled: sausage || qty !== TARGET_QTY })}
          </div>
        )
      default:
        return null
    }
  }

  return (
    <>
      {(ordering || orderDone) && (
        <Html fullscreen portal={bodyPortal} zIndexRange={zRange} style={overlay}>
          <div key={ordering ? 'ordering' : 'done'} ref={raiseWrapper} />
          {orderDone ? (
            <div style={donePanelStyle}>
              <h2 style={title} data-testid="ikea-done">{t('ikeaOrderDone')}</h2>
            </div>
          ) : (
            <>
              {!lookingBack && <div style={panelStyle}>{renderStep()}</div>}
              <button
                data-testid="ikea-look-back"
                className="restart-btn"
                style={lookBackButton}
                onClick={() => onLookBack(!lookingBack)}
                onKeyDown={(e) => e.code === 'Space' && e.preventDefault()}
              >
                {lookingBack ? t('ikeaBackToKiosk') : t('ikeaLookBack')}
              </button>
            </>
          )}
        </Html>
      )}
    </>
  )
}

export default OrderKiosk

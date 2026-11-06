import { Html } from '@react-three/drei'

// Mounted in <body> so the buttons sit above the canvas wrapper and the mobile controls.
const bodyPortal = { current: document.body }
const overlay = { pointerEvents: 'none' }
const button = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'auto' }

/**
 * The ordering kiosk's clickable DOM overlay (works on mobile). The 3D kiosk itself lives in IkeaStore.jsx.
 *
 * @param {object} props
 * @param {null|'intro'|'ordering'|'won'|'lost'} props.ikeaPhase  the overlay is only interactive in 'ordering'
 * @param {number} props.ikeaTimeLeft  seconds left (0..IKEA_ORDER_SECONDS)
 * @param {boolean} props.lookingBack  the player is looking back at Rasmus: the order is paused (the countdown is not)
 * @param {() => void} props.onOrderComplete  call once the order is paid (App sets phase 'won')
 * @param {(looking: boolean) => void} props.onLookBack  toggle looking back
 *
 * Test hooks: data-testid="ikea-pay" is the final "pay / complete order" button,
 * data-testid="ikea-look-back" toggles looking back.
 * STUB: one "Beställ" button that completes the order. Stage 2 replaces the content, not the contract.
 */
function OrderKiosk({ ikeaPhase, ikeaTimeLeft, lookingBack, onOrderComplete, onLookBack }) {
  const ordering = ikeaPhase === 'ordering'

  // drei only sets the wrapper's z-index once the projected position changes, which never happens for
  // a fixed kiosk (and not at all on a frozen clock): set it up front so the buttons sit above the mobile controls.
  // Relies on drei Html's DOM structure: wrapper > inner div (styles) > children. Re-check it when upgrading drei.
  const raiseWrapper = (el) => {
    if (el) el.parentElement.parentElement.style.zIndex = '100000'
  }

  return (
    <>
      {ordering && (
        <Html fullscreen portal={bodyPortal} zIndexRange={[100000, 50000]} style={overlay}>
          <div ref={raiseWrapper} />
          {!lookingBack && (
            <button data-testid="ikea-pay" className="restart-btn" style={{ ...button, bottom: '18%' }} onClick={onOrderComplete}>
              Beställ
            </button>
          )}
          <button data-testid="ikea-look-back" className="restart-btn" style={{ ...button, bottom: '8%' }} onClick={() => onLookBack(!lookingBack)}>
            {lookingBack ? 'Tillbaka' : 'Titta bakåt'}
          </button>
        </Html>
      )}
    </>
  )
}

export default OrderKiosk

/**
 * IKEA ordering kiosk overlay (level 4, Rasmus). STUB: only a "Betala" button.
 * Stage 2 builds the real vending-machine UI on this contract.
 *
 * Mounted by App.jsx while the current level is Rasmus.
 *
 * Props:
 *   ikeaPhase       null | 'intro' | 'ordering' | 'won' | 'lost'; only 'ordering' is interactive
 *   ikeaTimeLeft    seconds left of the ordering phase (40 -> 0, steps of 0.1)
 *   ikeaLookingBack whether Rasmus currently looks back at the player
 *   onOrderComplete () => void   the order is paid; App sets 'won' (ignored outside 'ordering')
 *   onLookBack      (bool) => void  report that Rasmus looks back / stops looking back
 */
function IkeaKiosk({ ikeaPhase, ikeaTimeLeft, ikeaLookingBack, onOrderComplete, onLookBack }) { // eslint-disable-line no-unused-vars
  if (ikeaPhase !== 'ordering') return null
  return (
    <div style={{ position: 'fixed', bottom: '12%', left: '50%', transform: 'translateX(-50%)', zIndex: 8500 }}>
      <button data-testid="ikea-pay" className="restart-btn" onClick={onOrderComplete}>
        Betala ({Math.ceil(ikeaTimeLeft)} s)
      </button>
    </div>
  )
}

export default IkeaKiosk

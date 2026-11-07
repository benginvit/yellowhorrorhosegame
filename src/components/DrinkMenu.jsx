import { DRINKS } from '../levels/ikeaLayout'
import { getTranslation } from '../translations'

// Above the UI overlay (z-index 1000, see index.css) so the buttons get the clicks.
const backdrop = { position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }
const panel = {
  width: 'min(92vw, 420px)',
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
const button = { display: 'block', width: '100%', margin: '8px 0', padding: '14px', fontSize: '20px', touchAction: 'manipulation' }

/**
 * Drink menu (DOM placeholder: one button per drink). Stage 2 replaces the look, not the contract.
 *
 * Contract: `data-testid="ikea-drink-{id}"` per drink id in DRINKS (ikeaLayout.js), `ikea-drink-close` for the close button.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(id: string) => void} props.onChoose  called with a drink id from DRINKS
 * @param {() => void} props.onClose
 * @param {string} [props.language]
 */
function DrinkMenu({ open, onChoose, onClose, language = 'sv' }) {
  if (!open) return null
  const t = (key) => getTranslation(language, key)
  return (
    <div style={backdrop}>
      <div style={panel} data-testid="ikea-drink-menu">
        <h2 style={{ margin: '4px 0 10px', fontSize: '24px', color: '#ffda1a' }}>{t('ikeaDrinkMenuTitle')}</h2>
        {DRINKS.map((id) => (
          <button key={id} type="button" className="restart-btn" style={button} data-testid={`ikea-drink-${id}`} onClick={() => onChoose(id)}>
            {t(`ikeaDrink_${id}`)}
          </button>
        ))}
        <button type="button" className="restart-btn" style={button} data-testid="ikea-drink-close" onClick={onClose}>
          {t('ikeaDrinkClose')}
        </button>
      </div>
    </div>
  )
}

export default DrinkMenu

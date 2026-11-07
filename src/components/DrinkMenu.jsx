import { DRINKS } from '../levels/ikeaLayout'
import { getTranslation } from '../translations'

// Glass colour per drink (DRINKS ids in ikeaLayout.js).
const DRINK_COLORS = {
  water: '#d9f1ff',
  sparkling: '#c4e8f7',
  lemonade: '#f3e36b',
  elderflower: '#e6e3b0',
  lingon: '#b3123a',
  raspberry: '#e0457b',
  cola: '#3b2314',
  colaLight: '#6b6b6b',
}

// Above the UI overlay (z-index 1000, see index.css) so the buttons get the clicks.
const backdrop = { position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }
const panel = {
  width: 'min(94vw, 460px)',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxSizing: 'border-box',
  padding: '12px',
  background: '#0b3d91',
  border: '6px solid #ffda1a',
  borderRadius: '14px',
  color: '#fff',
  textAlign: 'center',
  pointerEvents: 'auto',
  fontFamily: 'sans-serif',
}
const grid = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }
const button = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  minHeight: '88px',
  padding: '8px',
  fontSize: '17px',
  touchAction: 'manipulation',
}

function Glass({ color }) {
  return (
    <svg width="34" height="44" viewBox="0 0 34 44" aria-hidden="true">
      <path d="M4 2 H30 L27 42 H7 Z" fill="#ffffff" fillOpacity="0.25" stroke="#fff" strokeWidth="2" />
      <path d="M5.5 14 H28.5 L27 42 H7 Z" fill={color} />
    </svg>
  )
}

/**
 * Drink menu in the style of an IKEA drink machine: a screen with one big button (coloured glass + name) per drink,
 * in the order of DRINKS. One click is a choice, there is no undo. Walking away from the station closes it (App).
 *
 * Contract: `data-testid="ikea-drink-{id}"` per drink id in DRINKS (ikeaLayout.js), `ikea-drink-menu` for the panel.
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {(id: string) => void} props.onChoose  called with a drink id from DRINKS
 * @param {string|null} [props.language]  null falls back to 'en', like App
 */
function DrinkMenu({ open, onChoose, language }) {
  if (!open) return null
  const t = (key) => getTranslation(language || 'en', key)
  return (
    <div style={backdrop}>
      <div style={panel} data-testid="ikea-drink-menu">
        <h2 style={{ margin: '4px 0 10px', fontSize: '24px', color: '#ffda1a' }}>{t('ikeaDrinkMenuTitle')}</h2>
        <div style={grid}>
          {DRINKS.map((id) => (
            <button key={id} type="button" className="restart-btn" style={button} data-testid={`ikea-drink-${id}`} onClick={() => onChoose(id)}>
              <Glass color={DRINK_COLORS[id]} />
              {t(`ikeaDrink_${id}`)}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DrinkMenu

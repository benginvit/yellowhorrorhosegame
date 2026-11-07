import { getTranslation } from '../translations'

/**
 * HUD text for the IKEA serve / drink phases (placeholder: one text per phase) plus the "press F" hint.
 * intro / ordering keep their own HUD items in UI.jsx.
 *
 * @param {object} props
 * @param {object} props.gameState  ikeaPhase, ikeaCarrying, ikeaRasmusSeated, ikeaInteractTarget
 * @param {string|null} props.language
 */
function IkeaObjective({ gameState, language }) {
  const t = (key) => getTranslation(language || 'en', key)
  const { ikeaPhase, ikeaCarrying, ikeaRasmusSeated, ikeaInteractTarget } = gameState
  let key = null
  if (ikeaPhase === 'serve') key = !ikeaRasmusSeated ? 'ikeaObjServeWait' : ikeaCarrying === 'tray' ? 'ikeaObjServeTable' : 'ikeaObjServeTray'
  else if (ikeaPhase === 'drink') key = 'ikeaObjDrink'
  else if (ikeaPhase === 'deliverDrink') key = 'ikeaObjDeliverDrink'
  return (
    <>
      {key && <div className="hud-item" data-testid="ikea-objective" data-objective={key}>{t(key)}</div>}
      {ikeaInteractTarget && <div className="hud-item" data-testid="ikea-use-hint">{t('ikeaHintUse')}</div>}
    </>
  )
}

export default IkeaObjective

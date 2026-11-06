// Translation strings for the game
export const translations = {
  sv: {
    // Start screen
    gameTitle: 'YELLOW HORROR HOSE',
    gameDescription1: 'Hitta nyckeln och fly genom dörren!',
    gameDescription2: 'Undvik karaktärerna som jagar dig...',
    startButton: 'STARTA SPEL',
    selectLanguage: 'Välj språk / Select Language',

    // Game HUD
    level: 'Level',
    keyFound: 'Hittad! Gå till dörren!',
    keyNotFound: 'Inte hittad',
    health: 'Hälsa',

    // Astrid level
    astridSleeping: '😴 Astrid sover i sängen...',
    astridWaking: '⚠️ ASTRID VAKNAR - GÖM DIG NU!',
    hideTimer: 'Göm-timer',
    statusHidden: 'GÖMD!',
    statusVisible: 'SYNLIG!',
    enterHouseQuietly: 'Gå in i huset tyst...',

    // Instructions
    instructionsMove: 'WASD - Flytta',
    instructionsLook: 'Piltangenter/Q-E - Titta runt',
    instructionsHide: 'GÖM DIG UNDER SÄNGEN!',

    // Level complete
    levelCompleteMolltas: '🐱 DU UNDKOM KATTEN! 🐱',
    levelCompleteAstrid: '🎉 DU GÖMDE DIG! 🎉',
    levelCompleteSelma: '⭐ FANTASTISKT! ⭐',
    levelCompleteKerstin: '💪 BRA JOBBAT! 💪',
    levelCompleteRasmus: '🍝 16 KÖTTBULLAR LEVERERADE! 🍝',
    levelCompleteMaria: '🏆 HÄLFTEN KLAR! 🏆',
    levelCompletePappa: '👑 MÄSTARE! 👑',

    levelCompleteDescMolltas: 'Du sprang förbi Molltas och hittade nyckeln!',
    levelCompleteDescAstrid: 'Du lyckades gömma dig från Astrid!',
    levelCompleteDescSelma: 'Selma kunde inte hitta dig!',
    levelCompleteDescKerstin: 'Du var snabbare än Kerstin!',
    levelCompleteDescRasmus: 'Rasmus var bara hungrig.',
    levelCompleteDescMaria: 'Maria kunde inte stoppa dig!',
    levelCompleteDescPappa: 'Du klarade den svåraste nivån!',

    levelComplete: 'Level',
    levelCompleteWord: 'klar!',
    continueButton: 'FORTSÄTT TILL NÄSTA LEVEL',
    seeVictoryButton: 'SE SEGER!',

    // Game over
    gameOverTitle: 'DU BLEV TAGEN!',
    gameOverCaught: 'fångade dig...',
    gameOverReached: 'Du nådde Level',
    tryAgainButton: 'FÖRSÖK IGEN?',

    // Victory
    victoryTitle: 'SEGER!',
    victoryDesc1: 'Du undkom från alla 6 karaktärerna!',
    victoryDesc2: 'Grattis, du överlevde Yellow Horror Hose!',
    playAgainButton: 'SPELA IGEN'
  },

  en: {
    // Start screen
    gameTitle: 'YELLOW HORROR HOSE',
    gameDescription1: 'Find the key and escape through the door!',
    gameDescription2: 'Avoid the characters chasing you...',
    startButton: 'START GAME',
    selectLanguage: 'Välj språk / Select Language',

    // Game HUD
    level: 'Level',
    keyFound: 'Found! Go to the door!',
    keyNotFound: 'Not Found',
    health: 'Health',

    // Astrid level
    astridSleeping: '😴 Astrid is sleeping in bed...',
    astridWaking: '⚠️ ASTRID IS WAKING UP - HIDE NOW!',
    hideTimer: 'Hide Timer',
    statusHidden: 'HIDDEN!',
    statusVisible: 'VISIBLE!',
    enterHouseQuietly: 'Enter the house quietly...',

    // Instructions
    instructionsMove: 'WASD - Move',
    instructionsLook: 'Arrow Keys/Q-E - Look Around',
    instructionsHide: 'HIDE UNDER THE BED!',

    // Level complete
    levelCompleteMolltas: '🐱 YOU ESCAPED THE CAT! 🐱',
    levelCompleteAstrid: '🎉 YOU HID SUCCESSFULLY! 🎉',
    levelCompleteSelma: '⭐ AMAZING! ⭐',
    levelCompleteKerstin: '💪 WELL DONE! 💪',
    levelCompleteRasmus: '🍝 16 MEATBALLS DELIVERED! 🍝',
    levelCompleteMaria: '🏆 HALFWAY THERE! 🏆',
    levelCompletePappa: '👑 MASTER! 👑',

    levelCompleteDescMolltas: 'You ran past Molltas and found the key!',
    levelCompleteDescAstrid: 'You successfully hid from Astrid!',
    levelCompleteDescSelma: 'Selma couldn\'t find you!',
    levelCompleteDescKerstin: 'You were faster than Kerstin!',
    levelCompleteDescRasmus: 'Rasmus was just hungry.',
    levelCompleteDescMaria: 'Maria couldn\'t stop you!',
    levelCompleteDescPappa: 'You beat the hardest level!',

    levelComplete: 'Level',
    levelCompleteWord: 'Complete!',
    continueButton: 'CONTINUE TO NEXT LEVEL',
    seeVictoryButton: 'SEE VICTORY!',

    // Game over
    gameOverTitle: 'YOU WERE CAUGHT!',
    gameOverCaught: 'caught you...',
    gameOverReached: 'You reached Level',
    tryAgainButton: 'TRY AGAIN?',

    // Victory
    victoryTitle: 'VICTORY!',
    victoryDesc1: 'You escaped from all 6 characters!',
    victoryDesc2: 'Congratulations, you survived the Yellow Horror Hose!',
    playAgainButton: 'PLAY AGAIN'
  }
}

export const getTranslation = (language, key) => {
  return translations[language]?.[key] || translations['en'][key] || key
}

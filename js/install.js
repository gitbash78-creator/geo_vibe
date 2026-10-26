/* iPhone/iPad Add to Home Screen guidance. Safari owns the system install action. */
export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const DISMISSED = 'geovibe:ios-install-dismissed:v1'
let mounted=false, dialog, banner, dismissedInSession=false
function dismissedRecently() {
  if(dismissedInSession)return true
  try { return Date.now()-Number(localStorage.getItem(DISMISSED)||0) < 7*24*60*60*1000 } catch { return false }
}
export function refreshInstallPrompt() {
  if(!mounted) return
  const show=isIOS() && !isStandalone() && !dismissedRecently() && !['walk','go'].includes(document.body.dataset.view)
  banner.hidden=!show
  document.body.classList.toggle('has-install-banner',show)
  if(isStandalone() && dialog.open)dialog.close()
}
export function openInstallHelp() {
  if(!mounted || isStandalone())return
  const otherBrowser=/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent)
  dialog.querySelector('.ios-browser-note').hidden=!otherBrowser
  if(!dialog.open)dialog.showModal()
  dialog.querySelector('h2').focus({preventScroll:true})
}
export function initInstallPrompt() {
  if(mounted)return
  mounted=true
  banner=document.querySelector('#ios-install-banner')
  dialog=document.querySelector('#ios-install-sheet')
  document.addEventListener('click',e=>{
    const action=e.target.closest('[data-install]')?.dataset.install
    if(action==='open')openInstallHelp()
    if(action==='close')dialog.close()
    if(action==='dismiss') {
      dismissedInSession=true
      try{localStorage.setItem(DISMISSED,String(Date.now()))}catch{}
      banner.hidden=true;document.body.classList.remove('has-install-banner')
    }
  })
  dialog.addEventListener('click',e=>{
    if(e.target!==dialog)return
    const rect=dialog.getBoundingClientRect()
    if(e.clientY<rect.top || e.clientY>rect.bottom || e.clientX<rect.left || e.clientX>rect.right)dialog.close()
  })
  const media=matchMedia('(display-mode: standalone)')
  media.addEventListener?.('change',refreshInstallPrompt)
  window.addEventListener('appinstalled',refreshInstallPrompt)
  window.addEventListener('pageshow',refreshInstallPrompt)
  refreshInstallPrompt()
}

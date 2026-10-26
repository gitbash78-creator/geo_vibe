/* Anchor the mobile chat to the visual viewport. Only its bottom edge follows the keyboard. */
let baseline=window.innerHeight
let keyboardOpen=false
let frame=0
export function syncChatViewport() {
  const active=document.body.dataset.view==='go' && matchMedia('(max-width: 899px)').matches
  const viewport=window.visualViewport
  const scale=viewport?.scale || 1
  const focused=document.activeElement?.id==='go-in'
  const height=Math.round(viewport?.height || window.innerHeight)
  if(!active) {
    baseline=window.innerHeight
    keyboardOpen=false
    document.body.classList.remove('chat-keyboard-open')
    return
  }
  if(!focused && !keyboardOpen)baseline=Math.max(window.innerHeight,height)
  const unzoomed=Math.abs(scale-1)<.05
  keyboardOpen=unzoomed && (focused || keyboardOpen) && baseline-height>120
  // Safari may pan its visual viewport to focus an input. Follow that offset rather
  // than scrolling the document or moving the chat header outside the visible screen.
  document.documentElement.style.setProperty('--chat-viewport-height',`${unzoomed?height:window.innerHeight}px`)
  document.documentElement.style.setProperty('--chat-viewport-top',`${unzoomed?Math.max(0,viewport?.offsetTop||0):0}px`)
  document.body.classList.toggle('chat-keyboard-open',keyboardOpen)
}
function schedule() {
  if(frame)return
  frame=requestAnimationFrame(()=>{frame=0;syncChatViewport()})
}
export function initChatViewport() {
  window.visualViewport?.addEventListener('resize',schedule)
  window.visualViewport?.addEventListener('scroll',schedule)
  window.addEventListener('resize',schedule)
  document.addEventListener('focusin',schedule)
  document.addEventListener('focusout',schedule)
  window.addEventListener('pageshow',schedule)
}

// Expected text and parts come from src/components/interaction.md.
const REASON = 'This content did not show because it did not match the rules of the application.';
const NEXT = 'Ask for this content again. If the refusal shows again, tell the owner of the application.';

export function showsRefusal(root, component, error) {
  const reason = root?.querySelector('[part="reason"]');
  const next = root?.querySelector('[part="next"]');
  const details = root?.querySelector('details[part="details"]');
  const body = details?.querySelector(':scope > div');
  return reason?.checkVisibility() && reason.textContent === REASON
    && next?.checkVisibility() && next.textContent === NEXT
    && reason.nextElementSibling === next && !details?.contains(reason) && !details?.contains(next)
    && details?.open === false && details.firstElementChild?.matches('summary')
    && details.firstElementChild.textContent === 'Technical details'
    && body?.textContent === `${component}: ${error}` && body.childElementCount === 0;
}

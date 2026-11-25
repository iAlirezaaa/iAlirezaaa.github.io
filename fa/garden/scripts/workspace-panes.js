// REVIEW: local-only desktop workspace preferences.
export function installWorkspacePanes({body, storage, onChange = () => {}}) {
  const controls = body.querySelector('[data-workspace-panes]');
  if (!controls) return null;
  const key = 'hades-workspace-panes-v1';
  const defaults = {navigation:true, context:true, navigationWidth:230, contextWidth:240};
  const saved = storage.read(key, {}) || {};
  const limit = (value,min,max,fallback) => value != null && Number.isFinite(Number(value)) ? Math.max(min,Math.min(max,Math.round(Number(value)/10)*10)) : fallback;
  let state = {navigation:saved.navigation !== false, context:saved.context !== false,
    navigationWidth:limit(saved.navigationWidth,180,300,230), contextWidth:limit(saved.contextWidth,180,280,240)};
  let focus = false;
  const isHidden = name => focus || !state[name];
  const toggles = Array.from(body.querySelectorAll('[data-workspace-toggle]'));
  const ranges = Array.from(controls.querySelectorAll('[data-workspace-width]'));
  const focusButton = controls.querySelector('[data-workspace-focus]');
  const numbers = new Intl.NumberFormat('fa-IR');
  function apply(persist = false) {
    body.dataset.workspaceNavigation = state.navigation ? 'open' : 'closed';
    body.dataset.workspaceContext = state.context ? 'open' : 'closed';
    body.dataset.workspaceFocus = String(focus);
    body.style.setProperty('--workspace-explorer-width',state.navigationWidth+'px');
    body.style.setProperty('--workspace-context-width',state.contextWidth+'px');
    focusButton.setAttribute('aria-pressed',String(focus));
    focusButton.textContent = focus ? 'خروج از تمرکز' : 'حالت تمرکز';
    for (const button of toggles) {
      const name = button.dataset.workspaceToggle;
      button.setAttribute('aria-pressed',String(!isHidden(name)));
      button.disabled = focus;
    }
    for (const input of ranges) {
      const name = input.dataset.workspaceWidth;
      const value = state[name+'Width'];
      input.value = String(value);
      input.disabled = isHidden(name);
      const output = controls.querySelector('[data-workspace-value="'+name+'"]');
      if(output) output.textContent = numbers.format(value)+' px';
    }
    if(persist) storage.write(key,state);
  }
  function change(persist = false) { apply(persist); onChange(); }
  focusButton.addEventListener('click',()=>{focus=!focus;change();});
  for(const button of toggles) button.addEventListener('click',()=>{
    const name=button.dataset.workspaceToggle;state[name]=!state[name];change(true);
  });
  for(const input of ranges) input.addEventListener('input',()=>{
    const name=input.dataset.workspaceWidth;
    state[name+'Width']=limit(input.value,Number(input.min),Number(input.max),defaults[name+'Width']);change(true);
  });
  controls.querySelector('[data-workspace-reset]').addEventListener('click',()=>{state={...defaults};focus=false;change(true);});
  apply();controls.hidden=false;
  return {isHidden,toggle(name){if(!['navigation','context'].includes(name))return;if(focus){focus=false;state[name]=true;}else state[name]=!state[name];change(true);}};
}

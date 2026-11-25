// REVIEW: progressive code-copy enhancement; original code remains selectable.
export function installCodeCopy(root = document) {
  for (const pre of root.querySelectorAll('[data-note-body] pre')) {
    const code = pre.querySelector(':scope > code');
    if (!code || pre.closest('.reader-code')) continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'reader-code';
    const toolbar = document.createElement('div');
    toolbar.className = 'reader-code-toolbar';
    const language = document.createElement('bdi');
    language.textContent = [...code.classList].find(name => name.startsWith('language-'))?.slice(9) || 'Code';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'کپی کد';
    const status = document.createElement('span');
    status.className = 'reader-code-status';
    status.setAttribute('role', 'status');
    toolbar.append(language, button, status);
    pre.before(wrapper);
    wrapper.append(toolbar, pre);
    button.addEventListener('click', async () => {
      status.textContent = '';
      try {
        if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText(code.textContent);
        status.textContent = 'کد کپی شد.';
      } catch {
        const range = document.createRange();
        range.selectNodeContents(code);
        const selection = window.getSelection();
        if (selection) { selection.removeAllRanges(); selection.addRange(range); }
        status.textContent = 'کپی خودکار ممکن نیست؛ کد را دستی کپی کن.';
      }
    });
  }
}

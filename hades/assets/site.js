
(() => {
  const button = document.querySelector('[data-copy-color]');
  const announce = document.querySelector('[data-copy-status]');
  if (!button || !announce) return;
  button.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard || !window.isSecureContext) throw new Error('Unavailable');
      await navigator.clipboard.writeText('#EF4B32');
      announce.textContent = button.dataset.copied || 'Copied';
    } catch {
      announce.textContent = button.dataset.failure || 'Select and copy #EF4B32';
    }
  });
})();

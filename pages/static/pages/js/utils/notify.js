export function showSaveIndicator(message) {
  let indicator = document.getElementById('saveIndicator');
  if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'saveIndicator';
      indicator.className = 'save-indicator';
      document.body.appendChild(indicator);
  }
  indicator.textContent = message;
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 2000);
}

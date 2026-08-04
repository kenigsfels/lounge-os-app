export function renderToast() {
  return '<div class="toast" role="status" aria-live="polite"></div>';
}

export function createToast(element) {
  let timer;

  return function showToast(message) {
    element.textContent = message;
    element.classList.add('is-visible');
    clearTimeout(timer);
    timer = setTimeout(() => element.classList.remove('is-visible'), 2200);
  };
}

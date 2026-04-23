// src/utils/TouchBlocker.ts

/**
 * Жёсткий блокировщик нативных жестов браузера.
 * "Ядерное решение" против скролла на iOS, которое CSS не всегда ловит.
 */

export function initTouchBlocker() {
  // Пассивный слушатель не позволяет вызвать preventDefault, поэтому passive: false
  document.addEventListener('touchmove', (e) => {
    // Разрешаем скролл только если это явно элемент с классом 'scrollable' (например, логи или список лидеров)
    let target = e.target as HTMLElement;
    while (target && target !== document.body) {
      if (target.classList && target.classList.contains('scrollable')) {
        return; // Разрешаем скролл
      }
      target = target.parentElement as HTMLElement;
    }
    
    // Иначе блокируем все свайпы, чтобы WebApp не дергался
    if (e.cancelable) {
      e.preventDefault();
    }
  }, { passive: false });
  
  // Блокируем зум щипком
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault();
  });
}

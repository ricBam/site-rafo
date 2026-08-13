// src/lib/focusTrap.ts
//
// Gestão de foco para overlays customizados (modal de saída, painel do
// menu mobile). Vanilla, sem dependência — o site não usa framework de UI.
// Reimplementa o padrão visto em componentes prontos (Radix/shadcn: mover
// foco pro container ao abrir, prender Tab dentro dele, devolver foco a
// quem tinha antes ao fechar) no idioma de scripts deste projeto.
//
// Quem chama decide QUANDO ativar/desativar (abrir/fechar do overlay) e é
// responsável por mover o foco inicial (ex: pro próprio container, ou pro
// primeiro link de um painel) — este helper só cuida do Tab preso e da
// devolução de foco.

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null
  );
}

export interface FocusTrapHandle {
  activate: () => void;
  deactivate: () => void;
}

export function createFocusTrap(container: HTMLElement): FocusTrapHandle {
  let previouslyFocused: HTMLElement | null = null;

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable(container);
    if (focusable.length === 0) {
      e.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const ativo = document.activeElement as HTMLElement | null;

    if (e.shiftKey) {
      if (ativo === first || !ativo || !container.contains(ativo)) {
        e.preventDefault();
        last.focus();
      }
    } else if (ativo === last || !ativo || !container.contains(ativo)) {
      e.preventDefault();
      first.focus();
    }
  }

  return {
    activate() {
      previouslyFocused = document.activeElement as HTMLElement | null;
      container.addEventListener('keydown', handleKeydown);
    },
    deactivate() {
      container.removeEventListener('keydown', handleKeydown);
      previouslyFocused?.focus();
      previouslyFocused = null;
    },
  };
}

// Contador em vez de booleano simples: modal de saída e menu mobile usam
// o mesmo lock de forma independente, e um não pode destravar o scroll
// que o outro ainda precisa (caso raro de sobreposição, mas sem custo
// evitar).
let scrollLockCount = 0;

export function lockBodyScroll() {
  if (scrollLockCount === 0) {
    document.body.style.overflow = 'hidden';
  }
  scrollLockCount++;
}

export function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = '';
  }
}

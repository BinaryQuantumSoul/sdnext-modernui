/* Legacy stylesheet removal helper for ModernUI page cleanup. */
export async function removeStyleAssets(): Promise<void> {
  const t0 = performance.now();
  let removedStylesheets = 0;
  document.querySelectorAll(`
    [rel="stylesheet"][href*="/assets/"], 
    [rel="stylesheet"][href*="theme.css"],
    [rel="stylesheet"][href*="base.css"],
    [rel="stylesheet"][href*="file=style.css"]
  `).forEach((stylesheet) => {
    stylesheet.remove();
    removedStylesheets++;
    if (window.opts.uiux_enable_console_log) log('removeStylesheet', stylesheet.getAttribute('href'));
  });

  const stylers = document.querySelectorAll('.styler, [class*="svelte"]:not(input)');
  let count = 0;
  let removedCount = 0;

  stylers.forEach((element) => {
    const htmlElem = element as HTMLElement;
    if (htmlElem.style.display !== 'none' && htmlElem.style.display !== 'block') {
      htmlElem.removeAttribute('style');
      removedCount++;
    }

    [...element.classList].filter((className) => className.match(/^svelte.*/)).forEach((svelteClass) => element.classList.remove(svelteClass));
    count++;
  });
  const t1 = performance.now();
  log('removeElements', `elements=${removedCount}/${count} stylesheets=${removedStylesheets} time=${Math.round(t1 - t0)}`);
  timer('removeElements', t1 - t0);
}

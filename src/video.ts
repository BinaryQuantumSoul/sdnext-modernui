export async function bindVideoButtons() {
  const parentEl = document.getElementById('sidebar_video') as HTMLDivElement;
  const buttonsCtl = parentEl.querySelectorAll('button.video-none');
  const buttonsGen = parentEl.querySelectorAll('button.video-generate');
  const btnGenerate = document.getElementById('video-button-generate') as HTMLButtonElement;
  buttonsCtl.forEach((btn) => btn.addEventListener('click', () => {
    btnGenerate.classList.add('disabled');
  }));
  buttonsGen.forEach((btn) => btn.addEventListener('click', () => {
    btnGenerate.classList.remove('disabled');
  }));
}

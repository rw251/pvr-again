console.log('Renderer called');

console.log('window: ', window);

const { ipcRenderer } = window.require('electron');

console.log('ipcrend: ', ipcRenderer);

ipcRenderer.on('button', (event, arg) => {
  console.log(`BUTTON pressed: ${arg}`);
  const el = document.getElementById(arg);
  const highlight = document.querySelector('.highlight');
  if (highlight) highlight.classList.remove('highlight');
  if (el) {
    el.classList.add('highlight');
  }
});

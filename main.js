/**
 * The attractors.steren.fr page: renders the piece, keeps its config in the URL
 * and exposes every knob through a control panel.
 */
import GUI from 'lil-gui';
import { Attractors, DEFAULT_CONFIG } from './attractors.js';

/** Configuration of the piece, overridden by the one stored in the URL, if any. */
const config = {
  ...DEFAULT_CONFIG,
  text: 'A T T R A C T O R S',
  ...readConfigFromUrl(),
};

const canvas = document.getElementById(config.id);
const noGoElement = document.getElementById('nogo');
const settingsButton = document.getElementById('settings');

let attractors = null;

/** Reads the config shared through the URL hash. */
function readConfigFromUrl() {
  if (!window.location.hash) {
    return null;
  }
  try {
    return JSON.parse(decodeURIComponent(window.location.hash.slice(1)));
  } catch {
    console.warn('Could not read the configuration from the URL');
    return null;
  }
}

/** Position and size of the "nogo" element. */
function getNoGoParam() {
  return {
    x: noGoElement.offsetLeft,
    y: noGoElement.offsetTop,
    width: noGoElement.offsetWidth,
    height: noGoElement.offsetHeight,
  };
}

/** Restarts the render with the current config, and stores it in the URL. */
function reload() {
  config.nogoParam = getNoGoParam();
  window.location.hash = encodeURIComponent(JSON.stringify(config));

  attractors?.stop();
  attractors = new Attractors(config);
  attractors.start().catch((error) => console.error(error));
}

reload();

/** Types into the piece: any letter is appended to the text, Backspace erases. */
function onKeyDown(event) {
  // Let the control panel inputs handle their own keystrokes.
  if (event.target.closest('input, textarea')) {
    return;
  }

  if (event.key === 'Enter') {
    reload();
  } else if (event.key === 'Escape') {
    config.text = '';
    reload();
  } else if (event.key === 'Backspace') {
    event.preventDefault();
    config.text = config.text.slice(0, -1);
    reload();
  } else if (/^[a-zA-Z\s/]$/.test(event.key)) {
    config.text += event.key;
    reload();
  } else {
    return;
  }

  textController.updateDisplay();
}

document.body.addEventListener('keydown', onKeyDown);
canvas.addEventListener('click', reload);
window.addEventListener('resize', reload);

// Control panel.
const gui = new GUI({ title: 'Attractors' });
gui.close();
gui.onChange(reload);

gui.addColor(config, 'background_color').name('background');
gui.add(config, 'nb_attractors', 0, 500).name('attractors');
gui.add(config, 'particule_density', 0, 3000).name('density');
gui.add(config, 'init_scale', 0.01, 1.5).name('initial scale');
gui.add(config, 'speed', 0, 5).name('speed');
gui.add(config, 'nogo_zone').name('no go zone');

const textFolder = gui.addFolder('Text').close();
const textController = textFolder.add(config, 'text');
textFolder.add(config, 'text_width_ratio', 0, 50).name('width ratio');
textFolder.add(config, 'text_position_x', 0, 100).name('position x');
textFolder.add(config, 'text_position_y', 0, 100).name('position y');

const lineFolder = gui.addFolder('Lines').close();
lineFolder.add(config, 'line_width', 0, 5).name('width');
lineFolder.addColor(config, 'color1').name('color 1');
lineFolder.addColor(config, 'color2').name('color 2');

const shadowFolder = gui.addFolder('Shadows').close();
shadowFolder.add(config, 'shadow_scale', 0, 5).name('scale');

const advancedFolder = gui.addFolder('Advanced').close();
advancedFolder.add(config, 'pixelratio', 1, 10).name('pixel ratio');
advancedFolder.add(config, 'svg').name('record SVG');
advancedFolder.add(config, 'one_path').name('single path');
advancedFolder.add({ save: () => attractors?.saveSVG() }, 'save').name('save SVG');

let panelVisible = true;
settingsButton.addEventListener('click', () => {
  panelVisible = !panelVisible;
  gui.show(panelVisible);
});

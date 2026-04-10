/* ============================================================
   CHOOSE YOUR OWN ADVENTURE — engine + editor
   ============================================================

   Story file format (JSON):
   {
     title: string,
     startNodeId: string,
     nodes: {
       [id]: {
         id: string,
         x: number,          // editor canvas position
         y: number,
         text: string,
         image: string|null, // base64 data URL
         options: Array<{ text: string, targetNodeId: string }>
       }
     }
   }
   ============================================================ */

// ============================================================
// DEFAULT STORY
// ============================================================
const DEFAULT_STORY = {
  title: "The Forest Path",
  startNodeId: "n1",
  nodes: {
    n1: {
      id: "n1", x: 60, y: 100,
      text: "You stand at the edge of a dark forest. The trees loom overhead, their branches tangled like grasping fingers. A narrow path winds into the shadows ahead.",
      image: null,
      options: [
        { text: "Follow the path into the forest", targetNodeId: "n2" },
        { text: "Turn back toward town",           targetNodeId: "n3" }
      ]
    },
    n2: {
      id: "n2", x: 380, y: 40,
      text: "You venture deeper into the forest. The path winds between ancient oaks. Soon you hear the sound of running water nearby.",
      image: null,
      options: [
        { text: "Follow the sound of water", targetNodeId: "n4" },
        { text: "Keep to the path",           targetNodeId: "n5" }
      ]
    },
    n3: {
      id: "n3", x: 380, y: 260,
      text: "You return to the safety of town. The innkeeper gives you a warm meal and a soft bed for the night. Perhaps tomorrow you will be braver.",
      image: null,
      options: []
    },
    n4: {
      id: "n4", x: 700, y: 0,
      text: "You find a crystal-clear stream. An old woman sits beside it, holding a small glowing vial. She smiles and offers it to you.",
      image: null,
      options: [
        { text: "Drink from the vial",    targetNodeId: "n6" },
        { text: "Decline and move on",    targetNodeId: "n5" }
      ]
    },
    n5: {
      id: "n5", x: 700, y: 230,
      text: "The path opens into a clearing. An ancient stone tower stands before you, its door slightly ajar. Ivy crawls up its walls.",
      image: null,
      options: [
        { text: "Enter the tower", targetNodeId: "n7" }
      ]
    },
    n6: {
      id: "n6", x: 1020, y: 0,
      text: "The liquid tastes of starlight and pine. Warmth floods through you. The old woman smiles — you have been blessed with good fortune on your journey.",
      image: null,
      options: [
        { text: "Continue your journey", targetNodeId: "n5" }
      ]
    },
    n7: {
      id: "n7", x: 1020, y: 230,
      text: "Inside the tower, centuries of forgotten knowledge await. You spend years here, mastering ancient arts. Your adventure... is only just beginning.",
      image: null,
      options: []
    }
  }
};

// ============================================================
// STATE
// ============================================================
let story         = deepClone(DEFAULT_STORY);
let mode          = 'play';
let currentNodeId = story.startNodeId;
let selectedNodeId = null;
let dragState     = null; // { nodeId, startMouseX, startMouseY, origX, origY }

// ============================================================
// UTILITIES
// ============================================================
const $  = id  => document.getElementById(id);
const el = (tag, className, innerHTML) => {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (innerHTML != null) e.innerHTML = innerHTML;
  return e;
};
const svgEl = tag => document.createElementNS('http://www.w3.org/2000/svg', tag);

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

function genId() {
  return 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}

function nodeLabel(node) {
  const preview = node.text ? node.text.slice(0, 28) : '(empty)';
  return `${node.id}: ${preview}${node.text.length > 28 ? '…' : ''}`;
}

// ============================================================
// BOOT
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  // Topbar
  $('btn-play').addEventListener('click',   () => setMode('play'));
  $('btn-edit').addEventListener('click',   () => setMode('edit'));
  $('btn-import').addEventListener('click', () => $('file-input').click());
  $('btn-export').addEventListener('click', exportStory);
  $('file-input').addEventListener('change', importStory);
  $('story-title').addEventListener('click', editTitle);

  // Editor sidebar actions
  $('btn-add-node').addEventListener('click',   addNode);
  $('btn-set-start').addEventListener('click',  setAsStart);
  $('btn-delete-node').addEventListener('click', deleteSelectedNode);

  // Global drag handlers
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup',   onMouseUp);

  setMode('play');
});

// ============================================================
// MODE SWITCHING
// ============================================================
function setMode(m) {
  mode = m;
  $('play-view').classList.toggle('active', m === 'play');
  $('edit-view').classList.toggle('active', m === 'edit');
  $('btn-play').classList.toggle('active',  m === 'play');
  $('btn-edit').classList.toggle('active',  m === 'edit');

  if (m === 'play') {
    currentNodeId = story.startNodeId;
    renderNode();
  } else {
    renderEditor();
  }
}

// ============================================================
// PLAY ENGINE
// ============================================================
function renderNode() {
  const node = story.nodes[currentNodeId];

  if (!node) {
    $('game-text').textContent =
      'No starting node is set. Switch to Edit mode to build your story.';
    $('game-image').src = '';
    $('game-options').innerHTML = '';
    return;
  }

  // Image
  const img = $('game-image');
  img.src = node.image || '';

  // Text
  $('game-text').textContent = node.text;

  // Options
  const opts = $('game-options');
  opts.innerHTML = '';

  if (node.options.length === 0) {
    opts.appendChild(el('div', 'game-end', '— The End —'));
    const restart = el('button', 'option-btn restart-btn', 'Play Again');
    restart.addEventListener('click', () => {
      currentNodeId = story.startNodeId;
      renderNode();
    });
    opts.appendChild(restart);
  } else {
    node.options.forEach(opt => {
      if (!opt.text) return;
      const btn = el('button', 'option-btn', opt.text);
      btn.addEventListener('click', () => {
        const target = story.nodes[opt.targetNodeId];
        if (target) { currentNodeId = opt.targetNodeId; renderNode(); }
      });
      opts.appendChild(btn);
    });
  }
}

// ============================================================
// EDITOR — top-level
// ============================================================
function renderEditor() {
  renderGraph();
  renderSidebar();
}

// ============================================================
// EDITOR — graph canvas
// ============================================================
function renderGraph() {
  const canvas = $('editor-canvas');

  // Remove old node divs (leave the SVG)
  canvas.querySelectorAll('.editor-node').forEach(n => n.remove());

  for (const node of Object.values(story.nodes)) {
    canvas.appendChild(buildNodeCard(node));
  }

  // Connections need layout to be settled first
  requestAnimationFrame(renderConnections);
}

function buildNodeCard(node) {
  const div = el('div', 'editor-node');
  div.dataset.nodeId = node.id;
  div.style.left = node.x + 'px';
  div.style.top  = node.y + 'px';

  if (node.id === story.startNodeId) div.classList.add('start-node');
  if (node.id === selectedNodeId)    div.classList.add('selected');

  // Header row
  const header = el('div', 'node-header');
  header.appendChild(el('span', 'node-id', node.id));
  const badges = el('div', 'node-badges');
  if (node.id === story.startNodeId) badges.appendChild(el('span', 'badge badge-start', 'start'));
  if (node.options.length === 0)     badges.appendChild(el('span', 'badge badge-end',   'end'));
  header.appendChild(badges);
  div.appendChild(header);

  // Thumbnail
  if (node.image) {
    const img = el('img', 'node-thumb');
    img.src = node.image;
    div.appendChild(img);
  }

  // Text preview
  const preview = node.text
    ? node.text.slice(0, 90) + (node.text.length > 90 ? '…' : '')
    : '<em style="opacity:.5">No text</em>';
  div.appendChild(el('div', 'node-text-preview', preview));

  // Option list
  if (node.options.length > 0) {
    const list = el('div', 'node-options-list');
    node.options.forEach(opt => {
      const text = opt.text
        ? opt.text.slice(0, 36) + (opt.text.length > 36 ? '…' : '')
        : '<em style="opacity:.4">untitled option</em>';
      list.appendChild(el('div', 'node-option-preview',
        `<span class="opt-arrow">→</span>${text}`));
    });
    div.appendChild(list);
  }

  // Mouse events
  div.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    selectNode(node.id);
    dragState = {
      nodeId: node.id,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX: node.x,
      origY: node.y
    };
    e.stopPropagation();
    e.preventDefault();
  });

  return div;
}

// ============================================================
// EDITOR — SVG connections
// ============================================================
function renderConnections() {
  const svg    = $('editor-svg');
  const canvas = $('editor-canvas');

  // Clear everything except <defs>
  [...svg.children].forEach(c => { if (c.tagName !== 'defs') c.remove(); });

  for (const node of Object.values(story.nodes)) {
    const sourceEl = canvas.querySelector(`[data-node-id="${node.id}"]`);
    if (!sourceEl || node.options.length === 0) continue;

    const sw = sourceEl.offsetWidth;
    const sh = sourceEl.offsetHeight;
    const total = node.options.length;

    node.options.forEach((opt, i) => {
      if (!opt.targetNodeId || !story.nodes[opt.targetNodeId]) return;
      const target   = story.nodes[opt.targetNodeId];
      const targetEl = canvas.querySelector(`[data-node-id="${target.id}"]`);
      if (!targetEl) return;

      const th = targetEl.offsetHeight;

      // Spread source ports evenly down the right edge
      const syFrac = (i + 1) / (total + 1);
      const sx = node.x + sw;
      const sy = node.y + sh * syFrac;

      const tx = target.x;
      const ty = target.y + th * 0.5;

      const cpDist = Math.max(80, Math.abs(tx - sx) * 0.45);

      // Path
      const path = svgEl('path');
      path.setAttribute('class', 'conn-path');
      path.setAttribute('d',
        `M ${sx} ${sy} C ${sx + cpDist} ${sy} ${tx - cpDist} ${ty} ${tx} ${ty}`);
      svg.appendChild(path);

      // Label at curve midpoint
      if (opt.text) {
        const label = svgEl('text');
        label.setAttribute('class', 'conn-label');
        label.setAttribute('x', (sx + tx) / 2);
        label.setAttribute('y', (sy + ty) / 2 - 5);
        label.setAttribute('text-anchor', 'middle');
        label.textContent = opt.text.length > 22
          ? opt.text.slice(0, 22) + '…'
          : opt.text;
        svg.appendChild(label);
      }
    });
  }
}

// ============================================================
// EDITOR — drag
// ============================================================
function onMouseMove(e) {
  if (!dragState) return;

  const node = story.nodes[dragState.nodeId];
  node.x = Math.max(0, dragState.origX + (e.clientX - dragState.startMouseX));
  node.y = Math.max(0, dragState.origY + (e.clientY - dragState.startMouseY));

  const div = $('editor-canvas').querySelector(`[data-node-id="${dragState.nodeId}"]`);
  if (div) {
    div.style.left = node.x + 'px';
    div.style.top  = node.y + 'px';
  }

  renderConnections();
}

function onMouseUp() {
  dragState = null;
}

// ============================================================
// EDITOR — selection
// ============================================================
function selectNode(nodeId) {
  selectedNodeId = nodeId;

  document.querySelectorAll('.editor-node').forEach(d => {
    d.classList.toggle('selected', d.dataset.nodeId === nodeId);
  });

  $('btn-set-start').disabled  = !nodeId;
  $('btn-delete-node').disabled = !nodeId;

  renderSidebar();
}

// ============================================================
// EDITOR — sidebar
// ============================================================
function renderSidebar() {
  const hint   = $('sidebar-hint');
  const editor = $('node-editor');

  if (!selectedNodeId || !story.nodes[selectedNodeId]) {
    hint.style.display   = '';
    editor.style.display = 'none';
    editor.innerHTML = '';
    return;
  }

  hint.style.display   = 'none';
  editor.style.display = '';
  editor.innerHTML = '';

  const node = story.nodes[selectedNodeId];

  // ---- ID ----
  const idRow = el('div', 'form-row');
  idRow.appendChild(el('label', '', 'Node ID'));
  idRow.appendChild(el('span', 'node-id-display', node.id));
  editor.appendChild(idRow);

  // ---- Text ----
  const textRow = el('div', 'form-row');
  textRow.appendChild(el('label', '', 'Text'));
  const textarea = el('textarea', 'node-textarea');
  textarea.rows  = 5;
  textarea.value = node.text;
  textarea.addEventListener('input', () => {
    node.text = textarea.value;
    // Live-update the card preview without full re-render
    const card = $('editor-canvas').querySelector(`[data-node-id="${node.id}"] .node-text-preview`);
    if (card) card.innerHTML = node.text
      ? node.text.slice(0, 90) + (node.text.length > 90 ? '…' : '')
      : '<em style="opacity:.5">No text</em>';
  });
  textRow.appendChild(textarea);
  editor.appendChild(textRow);

  // ---- Image ----
  const imgRow  = el('div', 'form-row');
  imgRow.appendChild(el('label', '', 'Image'));
  const imgArea = el('div', 'img-upload-area');

  if (node.image) {
    const preview = el('img', 'sidebar-img-preview');
    preview.src = node.image;
    imgArea.appendChild(preview);
  }

  const imgFileInput = el('input');
  imgFileInput.type   = 'file';
  imgFileInput.accept = 'image/*';
  imgFileInput.style.display = 'none';
  imgFileInput.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      node.image = ev.target.result;
      renderEditor(); // rebuild card + sidebar with image
    };
    reader.readAsDataURL(file);
  });

  const btns = el('div', 'img-btns');
  const uploadBtn = el('button', 'btn-secondary', node.image ? 'Change image' : 'Upload image');
  uploadBtn.addEventListener('click', () => imgFileInput.click());
  btns.appendChild(uploadBtn);
  btns.appendChild(imgFileInput);

  if (node.image) {
    const removeImgBtn = el('button', 'btn-danger-sm', 'Remove');
    removeImgBtn.addEventListener('click', () => {
      node.image = null;
      renderEditor();
    });
    btns.appendChild(removeImgBtn);
  }

  imgArea.appendChild(btns);
  imgRow.appendChild(imgArea);
  editor.appendChild(imgRow);

  // ---- Options ----
  const optRow  = el('div', 'form-row');
  optRow.appendChild(el('label', '', 'Options'));

  const optList = el('div', 'options-editor-list');

  node.options.forEach((opt, i) => {
    const item = el('div', 'option-editor-item');

    // Option text
    const textInput = el('input', 'opt-text-input');
    textInput.type        = 'text';
    textInput.placeholder = 'Option text…';
    textInput.value       = opt.text;
    textInput.addEventListener('input', () => {
      opt.text = textInput.value;
      requestAnimationFrame(renderConnections);
    });

    // Target node dropdown
    const targetSel = el('select', 'opt-target-select');
    const blankOpt  = el('option', '', '— choose target —');
    blankOpt.value  = '';
    targetSel.appendChild(blankOpt);
    Object.values(story.nodes).forEach(n => {
      const o = el('option', '', nodeLabel(n));
      o.value = n.id;
      if (n.id === opt.targetNodeId) o.selected = true;
      targetSel.appendChild(o);
    });
    targetSel.addEventListener('change', () => {
      opt.targetNodeId = targetSel.value;
      requestAnimationFrame(renderConnections);
    });

    // Remove button
    const removeBtn = el('button', 'opt-remove-btn', '×');
    removeBtn.title = 'Remove option';
    removeBtn.addEventListener('click', () => {
      node.options.splice(i, 1);
      renderEditor();
    });

    item.appendChild(textInput);
    item.appendChild(targetSel);
    item.appendChild(removeBtn);
    optList.appendChild(item);
  });

  const addOptBtn = el('button', 'btn-add-opt', '+ Add option');
  addOptBtn.addEventListener('click', () => {
    node.options.push({ text: '', targetNodeId: '' });
    renderEditor();
  });

  optRow.appendChild(optList);
  optRow.appendChild(addOptBtn);
  editor.appendChild(optRow);
}

// ============================================================
// EDITOR — node management
// ============================================================
function addNode() {
  const id   = genId();
  const wrap = $('editor-canvas-wrap');
  const cx   = wrap.scrollLeft + wrap.clientWidth  / 2 - 110;
  const cy   = wrap.scrollTop  + wrap.clientHeight / 2 - 60;

  story.nodes[id] = { id, x: cx, y: cy, text: '', image: null, options: [] };

  if (!story.startNodeId) story.startNodeId = id;

  renderGraph();
  selectNode(id);
}

function setAsStart() {
  if (!selectedNodeId) return;
  story.startNodeId = selectedNodeId;
  currentNodeId     = selectedNodeId;
  renderGraph();
  renderSidebar();
}

function deleteSelectedNode() {
  if (!selectedNodeId) return;

  // Scrub references from other nodes' options
  for (const node of Object.values(story.nodes)) {
    node.options = node.options.filter(o => o.targetNodeId !== selectedNodeId);
  }
  if (story.startNodeId === selectedNodeId) story.startNodeId = null;
  delete story.nodes[selectedNodeId];

  selectedNodeId = null;
  $('btn-set-start').disabled  = true;
  $('btn-delete-node').disabled = true;
  renderEditor();
}

// ============================================================
// IMPORT / EXPORT
// ============================================================
function exportStory() {
  const json = JSON.stringify(story, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = sanitizeFilename(story.title || 'story') + '.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importStory(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      story         = data;
      currentNodeId = story.startNodeId;
      selectedNodeId = null;
      $('story-title').textContent = story.title || 'Untitled';
      setMode(mode);
    } catch (err) {
      alert('Could not parse story file:\n' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = ''; // allow re-importing same file
}

function editTitle() {
  const next = prompt('Story title:', story.title || '');
  if (next !== null && next.trim() !== '') {
    story.title = next.trim();
    $('story-title').textContent = story.title;
  }
}

function sanitizeFilename(s) {
  return s.replace(/[^a-z0-9_\- ]/gi, '_').trim() || 'story';
}

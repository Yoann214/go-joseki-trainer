const BOARD_SIZE = 19;
const LETTERS = "ABCDEFGHJKLMNOPQRST";

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const searchInput = document.getElementById("josekiSearch");
const select = document.getElementById("josekiSelect");
const currentTitleEl = document.getElementById("currentTitle");
const directLinkEl = document.getElementById("directLink");
const variationBoxEl = document.getElementById("variationBox");
const variationTitleEl = document.getElementById("variationTitle");
const tagsEl = document.getElementById("tags");
const goalEl = document.getElementById("goal");
const priorityEl = document.getElementById("priority");
const instructionEl = document.getElementById("instruction");
const statusEl = document.getElementById("status");
const hintBtn = document.getElementById("hintBtn");
const resetBtn = document.getElementById("resetBtn");
const answerBtn = document.getElementById("answerBtn");
const hintBox = document.getElementById("hintBox");
const answerBox = document.getElementById("answerBox");
const playedMovesEl = document.getElementById("playedMoves");

let JOSEKI = [];
let currentJoseki = null;
let currentVariations = [];
let activeVariation = null;
let activeSequence = null;
let filteredJoseki = [];
let stones = new Map();
let sequenceIndex = 0;
let hintIndex = 0;
let playedMoves = [];
let completed = false;

function coordToPoint(coord) {
  const x = LETTERS.indexOf(coord[0].toUpperCase());
  const yNumber = Number(coord.slice(1));
  return { x, y: BOARD_SIZE - yNumber };
}

function pointToCoord(x, y) {
  return LETTERS[x] + (BOARD_SIZE - y);
}

function key(x, y) {
  return `${x},${y}`;
}

function labelColor(color) {
  return color === "B" ? "Noir" : "Blanc";
}

function normalizeVariations(joseki) {
  if (Array.isArray(joseki.variations) && joseki.variations.length > 0) {
    return joseki.variations.map((variation, index) => ({
      id: variation.id || `variation-${index + 1}`,
      name: variation.name || `Variation ${index + 1}`,
      sequence: variation.sequence || []
    }));
  }

  return [{
    id: "main",
    name: "Séquence principale",
    sequence: joseki.sequence || []
  }];
}

async function loadJosekiData() {
  try {
    const response = await fetch("joseki.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    JOSEKI = await response.json();
    filteredJoseki = [...JOSEKI];
    populateSelect(filteredJoseki);

    const requested = getRequestedJosekiId();
    const firstId = requested && JOSEKI.some(j => j.id === requested) ? requested : JOSEKI[0]?.id;

    if (firstId) {
      loadJoseki(firstId);
      if (requested) searchInput.value = requested;
    } else {
      showEmptyState("Aucun joseki trouvé dans joseki.json.");
    }
  } catch (error) {
    console.error(error);
    showEmptyState("Impossible de charger joseki.json. Vérifie que le fichier est bien à la racine du dépôt GitHub.");
  }
}

function getRequestedJosekiId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("joseki") || params.get("id");
}

function updateUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set("joseki", id);
  window.history.replaceState({}, "", url);
  directLinkEl.textContent = url.href;
}

function populateSelect(list) {
  select.innerHTML = "";
  list.forEach(j => {
    const option = document.createElement("option");
    option.value = j.id;
    option.textContent = j.title;
    select.appendChild(option);
  });

  if (list.length > 0) {
    const stillVisible = currentJoseki && list.some(j => j.id === currentJoseki.id);
    if (!stillVisible) currentJoseki = list[0];
    select.value = currentJoseki.id;
  }
}

function filterJoseki() {
  const query = searchInput.value.trim().toLowerCase();
  filteredJoseki = JOSEKI.filter(j => {
    const title = (j.title || "").toLowerCase();
    const id = (j.id || "").toLowerCase();
    const tags = (j.tags || []).join(" ").toLowerCase();
    return title.includes(query) || id.includes(query) || tags.includes(query);
  });

  populateSelect(filteredJoseki);

  if (filteredJoseki.length > 0) {
    loadJoseki(select.value);
  } else {
    showEmptyState("Aucun joseki ne correspond à la recherche.");
  }
}

function showEmptyState(message) {
  stones = new Map();
  playedMoves = [];
  currentJoseki = null;
  activeVariation = null;
  activeSequence = null;
  currentTitleEl.textContent = "Aucune carte";
  directLinkEl.textContent = "";
  variationBoxEl.style.display = "none";
  variationTitleEl.textContent = "Aucune";
  tagsEl.innerHTML = "";
  goalEl.textContent = "";
  priorityEl.textContent = "";
  instructionEl.textContent = "";
  statusEl.className = "status bad";
  statusEl.textContent = message;
  hintBox.style.display = "none";
  answerBox.style.display = "none";
  renderPlayedMoves();
  drawBoard();
}

function loadJoseki(id) {
  currentJoseki = JOSEKI.find(j => j.id === id) || JOSEKI[0];
  if (!currentJoseki) return;
  if (select.options.length > 0) select.value = currentJoseki.id;

  currentVariations = normalizeVariations(currentJoseki);
  activeVariation = currentVariations.length === 1 ? currentVariations[0] : null;
  activeSequence = activeVariation ? activeVariation.sequence : null;

  updateUrl(currentJoseki.id);

  stones = new Map();
  sequenceIndex = 0;
  hintIndex = 0;
  playedMoves = [];
  completed = false;

  currentTitleEl.textContent = currentJoseki.title || currentJoseki.id;
  goalEl.textContent = currentJoseki.goal || "";
  priorityEl.textContent = currentJoseki.priority || "";
  instructionEl.textContent = currentJoseki.instruction || "";

  variationBoxEl.style.display = currentVariations.length > 1 ? "block" : "none";
  variationTitleEl.textContent = activeVariation ? activeVariation.name : "Choisie après ton premier coup";

  statusEl.className = "status";
  if (currentVariations.length > 1) {
    statusEl.textContent = `Plusieurs séquences sont possibles. Joue le premier coup ${labelColor(currentJoseki.playColor).toLowerCase()} correct pour choisir la variation.`;
  } else {
    statusEl.textContent = `Clique sur le goban pour jouer le prochain coup ${labelColor(currentJoseki.playColor).toLowerCase()}.`;
  }

  hintBox.style.display = "none";
  answerBox.style.display = "none";
  hintBox.textContent = "";
  answerBox.innerHTML = "";

  tagsEl.innerHTML = "";
  (currentJoseki.tags || []).forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tagsEl.appendChild(span);
  });

  (currentJoseki.start || []).forEach(([color, coord]) => placeStone(color, coord, false));
  renderPlayedMoves();
  drawBoard();
}

function placeStone(color, coord, record = true) {
  const { x, y } = coordToPoint(coord);
  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return;
  stones.set(key(x, y), color);

  if (record) {
    playedMoves.push([color, coord]);
    renderPlayedMoves();
  }

  drawBoard();
}

function drawBoard() {
  const w = canvas.width;
  const h = canvas.height;
  const margin = Math.round(w * 0.08);
  const grid = (w - 2 * margin) / (BOARD_SIZE - 1);

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#d9ad55";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "#2f2113";
  ctx.lineWidth = 1.6;

  for (let i = 0; i < BOARD_SIZE; i++) {
    const p = margin + i * grid;

    ctx.beginPath();
    ctx.moveTo(margin, p);
    ctx.lineTo(w - margin, p);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(p, margin);
    ctx.lineTo(p, h - margin);
    ctx.stroke();
  }

  ctx.fillStyle = "#2f2113";
  [3, 9, 15].forEach(x => {
    [3, 9, 15].forEach(y => {
      ctx.beginPath();
      ctx.arc(margin + x * grid, margin + y * grid, grid * 0.11, 0, Math.PI * 2);
      ctx.fill();
    });
  });

  ctx.font = "16px system-ui, sans-serif";
  ctx.fillStyle = "rgba(0,0,0,.65)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < BOARD_SIZE; i++) {
    ctx.fillText(LETTERS[i], margin + i * grid, h - margin * 0.42);
    ctx.fillText(String(BOARD_SIZE - i), margin * 0.42, margin + i * grid);
  }

  stones.forEach((color, pos) => {
    const [x, y] = pos.split(",").map(Number);
    drawStone(margin + x * grid, margin + y * grid, grid * 0.43, color);
  });

  if (completed) drawReviewMarkers(margin, grid);
}

function drawStone(cx, cy, r, color) {
  const gradient = ctx.createRadialGradient(cx - r * .35, cy - r * .35, r * .15, cx, cy, r);
  if (color === "B") {
    gradient.addColorStop(0, "#555");
    gradient.addColorStop(1, "#050505");
  } else {
    gradient.addColorStop(0, "#fff");
    gradient.addColorStop(1, "#d8d8d8");
  }

  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.strokeStyle = color === "B" ? "#000" : "#999";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function drawReviewMarkers(margin, grid) {
  const markers = currentJoseki.reviewMarkers || { good: [], bad: [] };

  (markers.good || []).forEach(coord => {
    const { x, y } = coordToPoint(coord);
    drawSquareMarker(margin + x * grid, margin + y * grid, grid * 0.24, "#16a34a");
  });

  (markers.bad || []).forEach(coord => {
    const { x, y } = coordToPoint(coord);
    drawSquareMarker(margin + x * grid, margin + y * grid, grid * 0.24, "#dc2626");
  });
}

function drawSquareMarker(cx, cy, half, color) {
  ctx.fillStyle = color;
  ctx.fillRect(cx - half, cy - half, half * 2, half * 2);
}

function clickedCoord(event) {
  const rect = canvas.getBoundingClientRect();
  const px = (event.clientX - rect.left) * (canvas.width / rect.width);
  const py = (event.clientY - rect.top) * (canvas.height / rect.height);

  const margin = Math.round(canvas.width * 0.08);
  const grid = (canvas.width - 2 * margin) / (BOARD_SIZE - 1);

  const x = Math.round((px - margin) / grid);
  const y = Math.round((py - margin) / grid);

  if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return null;
  return pointToCoord(x, y);
}

function firstExpectedUserMove(sequence) {
  let index = 0;
  while (index < sequence.length) {
    const [color, coord] = sequence[index];
    if (color === currentJoseki.playColor) return { coord, index };
    index++;
  }
  return null;
}

function chooseVariationFromMove(coord) {
  const matching = currentVariations.filter(variation => {
    const expected = firstExpectedUserMove(variation.sequence);
    return expected && expected.coord === coord;
  });

  if (matching.length === 0) return false;

  activeVariation = matching[0];
  activeSequence = activeVariation.sequence;
  sequenceIndex = firstExpectedUserMove(activeSequence).index;
  variationTitleEl.textContent = activeVariation.name;
  variationBoxEl.style.display = "block";
  return true;
}

function nextExpectedUserMove() {
  if (!activeSequence) return null;

  while (sequenceIndex < activeSequence.length) {
    const [color, coord] = activeSequence[sequenceIndex];
    if (color === currentJoseki.playColor) return coord;

    placeStone(color, coord);
    sequenceIndex++;
  }
  return null;
}

function playOpponentMoves() {
  if (!activeSequence) return;

  while (sequenceIndex < activeSequence.length) {
    const [color, coord] = activeSequence[sequenceIndex];
    if (color !== currentJoseki.playColor) {
      placeStone(color, coord);
      sequenceIndex++;
    } else {
      break;
    }
  }

  if (sequenceIndex >= activeSequence.length) finishSequence();
}

function finishSequence() {
  completed = true;
  statusEl.className = "status ok";
  statusEl.textContent = "Séquence terminée. Les carrés verts indiquent les points intéressants ; les carrés rouges indiquent les mauvais coups.";
  showAnswer();
  drawBoard();
}

function handleClick(event) {
  if (completed || !currentJoseki) return;

  const coord = clickedCoord(event);
  if (!coord) return;

  const { x, y } = coordToPoint(coord);
  if (stones.has(key(x, y))) {
    statusEl.className = "status bad";
    statusEl.textContent = `Intersection ${coord} déjà occupée.`;
    return;
  }

  if (!activeSequence) {
    const chosen = chooseVariationFromMove(coord);
    if (!chosen) {
      statusEl.className = "status bad";
      statusEl.textContent = `Pas ce coup. Tu as joué ${coord}. Cherche l'une des réponses correctes.`;
      return;
    }
  }

  const expected = nextExpectedUserMove();
  if (!expected) return;

  if (coord === expected) {
    placeStone(currentJoseki.playColor, coord);
    sequenceIndex++;
    statusEl.className = "status ok";
    statusEl.textContent = `Correct : ${labelColor(currentJoseki.playColor)} ${coord}.`;
    playOpponentMoves();
  } else {
    statusEl.className = "status bad";
    statusEl.textContent = `Pas ce coup. Tu as joué ${coord}. Cherche la direction du plan.`;
  }
}

function renderPlayedMoves() {
  playedMovesEl.innerHTML = "";
  playedMoves.forEach(([color, coord]) => {
    const li = document.createElement("li");
    li.textContent = `${labelColor(color)} ${coord}`;
    playedMovesEl.appendChild(li);
  });
}

function showHint() {
  if (!currentJoseki) return;
  const hints = currentJoseki.hints || [];
  hintBox.style.display = "block";

  if (hintIndex >= hints.length) {
    hintBox.textContent = "Il n’y a plus d’indice.";
  } else {
    hintBox.textContent = hints[hintIndex];
    hintIndex++;
  }
}

function sequenceToText(sequence) {
  return (sequence || [])
    .map(([color, coord]) => `${labelColor(color)} ${coord}`)
    .join(" → ");
}

function showAnswer() {
  if (!currentJoseki) return;

  let sequenceHtml = "";

  if (currentVariations.length > 1) {
    sequenceHtml = currentVariations.map(variation => {
      const active = activeVariation && variation.id === activeVariation.id ? " <em>(variation jouée)</em>" : "";
      return `<strong>${variation.name}</strong>${active}<br>${sequenceToText(variation.sequence)}`;
    }).join("<br><br>");
  } else {
    sequenceHtml = sequenceToText(activeSequence || currentVariations[0]?.sequence || []);
  }

  answerBox.innerHTML = `<strong>Séquence :</strong><br>${sequenceHtml}<br><br><strong>Explication :</strong><br>${currentJoseki.explanation || ""}`;
  answerBox.style.display = "block";
}

canvas.addEventListener("click", handleClick);
select.addEventListener("change", e => loadJoseki(e.target.value));
searchInput.addEventListener("input", filterJoseki);
hintBtn.addEventListener("click", showHint);
answerBtn.addEventListener("click", showAnswer);
resetBtn.addEventListener("click", () => currentJoseki && loadJoseki(currentJoseki.id));
window.addEventListener("resize", drawBoard);

loadJosekiData();

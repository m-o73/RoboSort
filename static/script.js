let model, webcamStream, maxPredictions = 0, labels = [], imageSize = 224;
const webcamEl = document.getElementById("webcam");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraSelect = document.getElementById("cameraSelect");
const predsEl = document.getElementById("predictions");
const statusBadge = document.getElementById("statusBadge");
const thresholdInput = document.getElementById("thresholdInput");
const thresholdValue = document.getElementById("thresholdValue");
const modelNameEl = document.getElementById("modelName");
const classCountEl = document.getElementById("classCount");
const imageSizeEl = document.getElementById("imageSize");

async function loadModel() {
  setStatus("loading model…","warn");
  // Model files are served from /model/
  const modelURL = "/model/model.json";
  const metadataURL = "/model/metadata.json";
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();
  const meta = await (await fetch(metadataURL)).json();
  labels = meta.labels || [];
  imageSize = meta.imageSize || 224;
  modelNameEl.textContent = meta.modelName || "—";
  classCountEl.textContent = String(maxPredictions);
  imageSizeEl.textContent = String(imageSize);
  renderPredictionRows(labels);
  setStatus("model ready","ok");
}

function renderPredictionRows(labels) {
  predsEl.innerHTML = "";
  labels.forEach(lab => {
    const row = document.createElement("div");
    row.className = "pred-row";
    row.innerHTML = `
      <div class="label">${lab}</div>
      <div class="bar"><span></span></div>
      <div class="score">0.00</div>
    `;
    predsEl.appendChild(row);
  });
}

async function populateCameraList() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videos = devices.filter(d => d.kind === "videoinput");
  cameraSelect.innerHTML = "";
  videos.forEach((d, i) => {
    const opt = document.createElement("option");
    opt.value = d.deviceId;
    opt.textContent = d.label || `Camera ${i+1}`;
    cameraSelect.appendChild(opt);
  });
}

async function startCamera() {
  setStatus("requesting camera…","warn");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Camera API not supported","err");
    alert("Your browser does not support getUserMedia.");
    return;
  }

  // Stop any existing stream first
  stopCamera();

  const constraints = {
    audio: false,
    video: { deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined, width: { ideal: 1280 }, height: { ideal: 720 } }
  };
  try {
    webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    webcamEl.srcObject = webcamStream;
    await webcamEl.play();
    // Resize overlay to match video
    overlay.width = webcamEl.videoWidth;
    overlay.height = webcamEl.videoHeight;
    setStatus("camera ready","ok");
    startBtn.disabled = true;
    stopBtn.disabled = false;
    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    setStatus("camera error","err");
    alert("Could not access the camera. Check permissions or use HTTPS/localhost.");
  }
}

function stopCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(t => t.stop());
    webcamStream = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("idle","");
}

async function loop() {
  if (!webcamStream) return;
  await predict();
  requestAnimationFrame(loop);
}

async function predict() {
  if (!model) return;

  // Draw a subtle overlay grid (cosmetic)
  ctx.clearRect(0,0,overlay.width, overlay.height);
  ctx.globalAlpha = 0.12;
  const step = 80;
  for (let x = 0; x < overlay.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,overlay.height); ctx.stroke();
  }
  for (let y = 0; y < overlay.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(overlay.width,y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Run classification on current frame
  const preds = await model.predict(webcamEl, false);
  const threshold = parseFloat(thresholdInput.value);

  // Sort descending
  preds.sort((a,b) => b.probability - a.probability);

  // Update UI rows
  const rows = predsEl.querySelectorAll(".pred-row");
  preds.forEach((p, idx) => {
    const row = rows[idx];
    if (!row) return;
    const bar = row.querySelector(".bar > span");
    const score = row.querySelector(".score");
    const percent = Math.round(p.probability * 100);
    bar.style.width = percent + "%";
    score.textContent = (p.probability).toFixed(2);
    // Dim rows under threshold
    row.style.opacity = p.probability >= threshold ? "1" : "0.4";
  });
}

function setStatus(text, kind) {
  statusBadge.textContent = text;
  statusBadge.className = "badge " + (kind || "");
}

thresholdInput.addEventListener("input", () => {
  thresholdValue.textContent = parseFloat(thresholdInput.value).toFixed(2);
});

startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

(async function init(){
  await loadModel();
  await populateCameraList();
  thresholdValue.textContent = parseFloat(thresholdInput.value).toFixed(2);
})();

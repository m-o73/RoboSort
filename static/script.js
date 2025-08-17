let model, webcamStream, maxPredictions = 0, labels = [], imageSize = 224;

const webcamEl = document.getElementById("webcam");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const cameraSelect = document.getElementById("cameraSelect");
const predsEl = document.getElementById("predictions");
const statusBadge = document.getElementById("statusBadge");
const modelNameEl = document.getElementById("modelName");
const classCountEl = document.getElementById("classCount");
const imageSizeEl = document.getElementById("imageSize");

// NEW: upload support
const imageUpload = document.getElementById("imageUpload");
const uploadedImage = document.getElementById("uploadedImage");

// Offscreen square input canvas that matches the model input size
const inputCanvas = document.createElement("canvas");
const inputCtx = inputCanvas.getContext("2d");

async function loadModel() {
  setStatus("loading model…", "warn");
  const modelURL = "/model/model.json";
  const metadataURL = "/model/metadata.json";
  model = await tmImage.load(modelURL, metadataURL);
  maxPredictions = model.getTotalClasses();

  const meta = await (await fetch(metadataURL)).json();
  labels = meta.labels || [];
  imageSize = meta.imageSize || 224;

  // configure offscreen canvas to model's expected size
  inputCanvas.width = imageSize;
  inputCanvas.height = imageSize;

  modelNameEl.textContent = meta.modelName || "—";
  classCountEl.textContent = String(maxPredictions);
  imageSizeEl.textContent = String(imageSize);

  renderPredictionRows(labels);
  setStatus("model ready", "ok");
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
    opt.textContent = d.label || `Camera ${i + 1}`;
    cameraSelect.appendChild(opt);
  });
}

async function startCamera() {
  setStatus("requesting camera…", "warn");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Camera API not supported", "err");
    alert("Your browser does not support getUserMedia.");
    return;
  }

  stopCamera();

  const constraints = {
    audio: false,
    video: {
      deviceId: cameraSelect.value ? { exact: cameraSelect.value } : undefined,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: "environment"
    }
  };

  try {
    webcamStream = await navigator.mediaDevices.getUserMedia(constraints);
    webcamEl.srcObject = webcamStream;
    await webcamEl.play();

    // Match overlay to actual video size
    overlay.width = webcamEl.videoWidth;
    overlay.height = webcamEl.videoHeight;

    setStatus("camera ready", "ok");
    startBtn.disabled = true;
    stopBtn.disabled = false;

    requestAnimationFrame(loop);
  } catch (e) {
    console.error(e);
    setStatus("camera error", "err");
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
  setStatus("idle", "");
}

async function loop() {
  if (!webcamStream) return;
  await predictFromWebcam();
  requestAnimationFrame(loop);
}

// --- PREPROCESSING: square center-crop & resize to model imageSize ---
function drawSquareCenterCropToInputCanvas(mediaEl) {
  const srcW = mediaEl.videoWidth || mediaEl.naturalWidth || mediaEl.width;
  const srcH = mediaEl.videoHeight || mediaEl.naturalHeight || mediaEl.height;
  if (!srcW || !srcH) return;

  const size = Math.min(srcW, srcH); // square crop size
  const sx = (srcW - size) / 2;
  const sy = (srcH - size) / 2;

  inputCtx.clearRect(0, 0, imageSize, imageSize);
  inputCtx.drawImage(
    mediaEl,
    sx, sy, size, size,       // source (center-cropped square)
    0, 0, imageSize, imageSize // dest (model's input size)
  );
  return inputCanvas;
}

// Webcam prediction 
async function predictFromWebcam() {
  if (!model) return;

  // Cosmetic grid overlay
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.globalAlpha = 0.12;
  const step = 80;
  for (let x = 0; x < overlay.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, overlay.height); ctx.stroke();
  }
  for (let y = 0; y < overlay.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(overlay.width, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const input = drawSquareCenterCropToInputCanvas(webcamEl);
  if (!input) return;

  const preds = await model.predict(input, false);
  preds.sort((a, b) => b.probability - a.probability);
  updateUI(preds);
}

// File upload → prediction
async function runImagePrediction(imgEl) {
  if (!model) {
    setStatus("Model not loaded", "err");
    return;
  }
  const input = drawSquareCenterCropToInputCanvas(imgEl);
  if (!input) return;

  const preds = await model.predict(input, false);
  preds.sort((a, b) => b.probability - a.probability);
  updateUI(preds);
}

// Update prediction bars & numbers
function updateUI(preds) {
  const rows = predsEl.querySelectorAll(".pred-row");
  preds.forEach((p, idx) => {
    const row = rows[idx];
    if (!row) return;
    const bar = row.querySelector(".bar > span");
    const score = row.querySelector(".score");
    const percent = Math.round(p.probability * 100);
    bar.style.width = percent + "%";
    score.textContent = (p.probability).toFixed(2);
    row.style.opacity = "1";
  });
}

function setStatus(text, kind) {
  statusBadge.textContent = text;
  statusBadge.className = "badge " + (kind || "");
}
imageUpload.addEventListener("change", handleImageUpload);

function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    uploadedImage.src = e.target.result;
    uploadedImage.style.display = "block";
    uploadedImage.onload = () => runImagePrediction(uploadedImage);
  };
  reader.readAsDataURL(file);
}

async function runImagePrediction(img) {
  if (!model) {
    setStatus("Model not loaded", "err");
    return;
  }

  const preds = await model.predict(img, false);

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
    row.style.opacity = "1";
    removeImageBtn.style.display = "inline-block";
  });
}


// Upload handlers
if (imageUpload) {
  imageUpload.addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      uploadedImage.src = e.target.result;
      uploadedImage.style.display = "block";
      uploadedImage.onload = () => runImagePrediction(uploadedImage);
    };
    reader.readAsDataURL(file);
  });
}
const removeImageBtn = document.getElementById("removeImageBtn");

removeImageBtn.addEventListener("click", () => {
  uploadedImage.src = "";
  uploadedImage.style.display = "none";
  removeImageBtn.style.display = "none";
  
  // Clear prediction bars
  const rows = predsEl.querySelectorAll(".pred-row");
  rows.forEach((row) => {
    const bar = row.querySelector(".bar > span");
    const score = row.querySelector(".score");
    bar.style.width = "0%";
    score.textContent = "0.00";
    row.style.opacity = "0.5";
  });

  // Reset file input
  imageUpload.value = "";
});


startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);

(async function init() {
  await loadModel();
  await populateCameraList();
})();

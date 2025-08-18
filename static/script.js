let model, webcamStream, maxPredictions = 0, labels = [], imageSize = 224;

// Model configuration
const MODEL_BASE_URL = "https://teachablemachine.withgoogle.com/models/7Y6ziI1bb/";
const modelURL = MODEL_BASE_URL + "model.json";
const metadataURL = MODEL_BASE_URL + "metadata.json";

// DOM elements
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
const imageUpload = document.getElementById("imageUpload");
const uploadedImage = document.getElementById("uploadedImage");
const removeImageBtn = document.getElementById("removeImageBtn");

// Offscreen canvas for image processing
const inputCanvas = document.createElement("canvas");
const inputCtx = inputCanvas.getContext("2d");

// When an image is uploaded we want to pause webcam predictions so they don't overwrite uploaded results.
let pauseWebcam = false;

async function loadModel() {
  setStatus("loading model…", "warn");
  try {
    // Load model from Teachable Machine
    model = await tmImage.load(modelURL, metadataURL);
    maxPredictions = model.getTotalClasses ? model.getTotalClasses() : (model.getNumClasses ? model.getNumClasses() : 0);

    // Try to read metadata labels; tmImage metadata structure can vary by version.
    let metadata = {};
    try { metadata = await model.getMetadata(); } catch (_) { metadata = {}; }

    labels = metadata.labels || metadata.classNames || labels || [];
    // If no labels provided, create generic labels to match maxPredictions
    if ((!labels || labels.length === 0) && maxPredictions > 0) {
      labels = Array.from({length: maxPredictions}, (_, i) => `Class ${i+1}`);
    }

    // Some models include imageSize in metadata; fallback to 224
    imageSize = metadata.imageSize || imageSize || 224;

    // Configure input canvas
    inputCanvas.width = imageSize;
    inputCanvas.height = imageSize;

    // Update UI with model info
    modelNameEl.textContent = metadata.name || "Clothing Classifier";
    classCountEl.textContent = String(maxPredictions || labels.length || "—");
    imageSizeEl.textContent = String(imageSize);

    renderPredictionRows(labels);
    setStatus("model ready", "ok");

    console.log("Model loaded successfully");
  } catch (error) {
    console.error("Error loading model:", error);
    setStatus("model load failed", "err");
    alert("Failed to load model. Please check console for details.");
  }
}

function renderPredictionRows(labelsList) {
  predsEl.innerHTML = "";
  labelsList.forEach(lab => {
    const row = document.createElement("div");
    row.className = "pred-row";
    // store the label in a data attribute so we can find it reliably
    row.setAttribute("data-label", lab);
    row.innerHTML = `
      <div class="label">${lab}</div>
      <div class="bar"><span></span></div>
      <div class="score">0.00</div>
    `;
    // start with faded rows
    row.style.opacity = "0.5";
    predsEl.appendChild(row);
  });
}

async function populateCameraList() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videos = devices.filter(d => d.kind === "videoinput");
    cameraSelect.innerHTML = "";
    videos.forEach((d, i) => {
      const opt = document.createElement("option");
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${i + 1}`;
      cameraSelect.appendChild(opt);
    });
  } catch (error) {
    console.error("Error enumerating devices:", error);
  }
}

async function startCamera() {
  setStatus("requesting camera…", "warn");
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus("Camera API not supported", "err");
    alert("Your browser does not support camera access.");
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

    // Match overlay to video size
    overlay.width = webcamEl.videoWidth || webcamEl.clientWidth || 640;
    overlay.height = webcamEl.videoHeight || webcamEl.clientHeight || 480;

    setStatus("camera ready", "ok");
    startBtn.disabled = true;
    stopBtn.disabled = false;

    // ensure webcam predictions aren't active if user just uploaded an image
    pauseWebcam = uploadedImage.style.display === "block";

    requestAnimationFrame(loop);
  } catch (error) {
    console.error("Camera error:", error);
    setStatus("camera error", "err");
    alert("Could not access the camera. Please ensure permissions are granted.");
  }
}

function stopCamera() {
  if (webcamStream) {
    webcamStream.getTracks().forEach(track => track.stop());
    webcamStream = null;
  }
  startBtn.disabled = false;
  stopBtn.disabled = true;
  setStatus("idle", "");
}

async function loop() {
  if (!webcamStream) return;
  // if paused (because user uploaded an image), skip webcam predictions
  if (!pauseWebcam) {
    await predictFromWebcam();
  }
  requestAnimationFrame(loop);
}

function drawSquareCenterCropToInputCanvas(mediaEl) {
  // Ensure the canvas matches the model input size each call (in case metadata changed)
  inputCanvas.width = imageSize;
  inputCanvas.height = imageSize;

  const srcW = mediaEl.videoWidth || mediaEl.naturalWidth || mediaEl.width;
  const srcH = mediaEl.videoHeight || mediaEl.naturalHeight || mediaEl.height;
  if (!srcW || !srcH) return null;

  const size = Math.min(srcW, srcH);
  const sx = Math.round((srcW - size) / 2);
  const sy = Math.round((srcH - size) / 2);

  inputCtx.clearRect(0, 0, imageSize, imageSize);
  // draw the center-cropped square to the model's input size
  inputCtx.drawImage(
    mediaEl,
    sx, sy, size, size,
    0, 0, imageSize, imageSize
  );
  return inputCanvas;
}

async function predictFromWebcam() {
  if (!model || !webcamEl) return;

  // Draw grid overlay
  ctx.clearRect(0, 0, overlay.width, overlay.height);
  ctx.globalAlpha = 0.12;
  const step = 80;
  ctx.strokeStyle = "#000";
  for (let x = 0; x < overlay.width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, overlay.height); ctx.stroke();
  }
  for (let y = 0; y < overlay.height; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(overlay.width, y); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const input = drawSquareCenterCropToInputCanvas(webcamEl);
  if (!input) return;

  try {
    // Do NOT sort here; we will map prediction results to their labels by className
    const preds = await model.predict(input, false);
    updateUI(preds);
  } catch (error) {
    console.error("Prediction error:", error);
  }
}

function handleImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedImage.src = e.target.result;
    uploadedImage.style.display = "block";
    uploadedImage.onload = () => runImagePrediction(uploadedImage);
    // when an image is uploaded we pause webcam predictions
    pauseWebcam = true;
  };
  reader.readAsDataURL(file);
}

async function runImagePrediction(img) {
  if (!model) {
    setStatus("Model not loaded", "err");
    return;
  }

  // Draw/crop to input canvas first (preferred), but fall back to passing the image element directly if needed
  const input = drawSquareCenterCropToInputCanvas(img) || img;

  try {
    const preds = await model.predict(input, false);
    console.log("predicted (image):", preds);
    updateUI(preds);
    removeImageBtn.style.display = "inline-block";
    setStatus("image predicted", "ok");
  } catch (error) {
    console.error("Image prediction error:", error);
  }
}

function updateUI(preds) {
  // Build a map className -> probability for quick lookup
  const probMap = {};
  preds.forEach(p => {
    // tmImage examples may use `className` or `class` property; be defensive:
    const name = p.className || p.class || p.label || String(p.labelName || "");
    probMap[name] = p.probability != null ? p.probability : (p.prob || 0);
  });

  // For each rendered row (in original label order) update using its data-label
  const rows = predsEl.querySelectorAll(".pred-row");
  rows.forEach(row => {
    const label = row.getAttribute("data-label");
    const bar = row.querySelector(".bar > span");
    const score = row.querySelector(".score");
    const prob = probMap[label] != null ? probMap[label] : 0;
    const percent = Math.round(prob * 100);
    bar.style.width = percent + "%";
    score.textContent = prob.toFixed(2);
    row.style.opacity = "1";
  });
}

function removeUploadedImage() {
  uploadedImage.src = "";
  uploadedImage.style.display = "none";
  removeImageBtn.style.display = "none";
  imageUpload.value = "";

  // resume webcam predictions (if camera running)
  pauseWebcam = false;

  // Reset predictions display to zeros
  const rows = predsEl.querySelectorAll(".pred-row");
  rows.forEach(row => {
    const bar = row.querySelector(".bar > span");
    const score = row.querySelector(".score");
    bar.style.width = "0%";
    score.textContent = "%0";
    row.style.opacity = "%5";
  });
}

function setStatus(text, kind) {
  statusBadge.textContent = text;
  statusBadge.className = "badge " + (kind || "");
}

// Event listeners
startBtn.addEventListener("click", startCamera);
stopBtn.addEventListener("click", stopCamera);
imageUpload.addEventListener("change", handleImageUpload);
removeImageBtn.addEventListener("click", removeUploadedImage);

// Initialize
(async function init() {
  await loadModel();
  await populateCameraList();
})();

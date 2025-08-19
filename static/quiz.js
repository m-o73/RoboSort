// Quiz using only two choices: "Usable" or "Not usable"
let imageList = [], usedImages = [];
let currentRound = 0;
const totalRounds = 5;
let score = 0;

const quizImage = document.getElementById("quizImage");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const nextBtn = document.getElementById("nextQuestionBtn");
const quizSection = document.getElementById("quizSection");

const choicesForUser = ["Usable", "Not usable"];

// Get image list from backend
async function loadImages() {
  const res = await fetch("/api/images");
  const imageData = await res.json();

  // Normalize labels to match choices
  imageList = imageData.map(img => {
    let normalizedLabel;
    if (img.label.toLowerCase() === "usable") {
      normalizedLabel = "Usable";
    } else {
      normalizedLabel = "Not usable";
    }
    return { image: img.image, label: normalizedLabel };
  });
}

// Start quiz once everything ready
async function initQuiz() {
  await loadImages();
  if (imageList.length === 0) {
    quizFeedback.textContent = "⚠️ No images found in /static/images";
    return;
  }
  startQuizRound();
}

async function startQuizRound() {
  quizFeedback.textContent = "";
  nextBtn.style.display = "none";
  quizOptions.innerHTML = "";

  document.getElementById("roundDisplay").textContent =
    `Round ${currentRound + 1} of ${totalRounds}`;
  document.getElementById("scoreDisplay").textContent = `Score: ${score}`;

  let randomImageData;
  if (imageList.length > 0) {
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * imageList.length);
      randomImageData = imageList[randomIndex];
    } while (usedImages.includes(randomImageData.image) && imageList.length > usedImages.length);

    usedImages.push(randomImageData.image);
    imageList.splice(randomIndex, 1);
  } else {
    quizFeedback.textContent = "⚠️ All questions have been used.";
    nextBtn.style.display = "none";
    return;
  }

  quizImage.src = randomImageData.image;
  quizImage.style.display = "block";
  await new Promise(res => (quizImage.onload = res));

  const correctAnswer = randomImageData.label; // "Usable" or "Not usable"

  choicesForUser.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => checkAnswer(choice, correctAnswer);
    quizOptions.appendChild(btn);
  });
}

function checkAnswer(choice, correctAnswer) {
  const buttons = quizOptions.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correctAnswer) {
      btn.style.backgroundColor = "#4CAF50";
    }
    if (btn.textContent === choice && choice !== correctAnswer) {
      btn.style.backgroundColor = "#F44336";
    }
  });

  if (choice === correctAnswer) {
    quizFeedback.textContent = "✅ Correct!";
    quizFeedback.style.color = "lime";
    score += 1;
  } else {
    quizFeedback.textContent = `❌ Wrong! Correct: ${correctAnswer}`;
    quizFeedback.style.color = "red";
  }

  document.getElementById("scoreDisplay").textContent = `Score: ${score}`;
  nextBtn.style.display = "inline-block";
}

nextBtn.onclick = () => {
  currentRound++;
  if (currentRound < totalRounds) {
    startQuizRound();
  } else {
    quizSection.innerHTML = `
      <h2>Quiz Complete!</h2>
      <p>Your final score: ${score}/${totalRounds}</p>
      <button onclick="location.reload()">Play Again</button>
    `;
  }
};

window.addEventListener("load", initQuiz);

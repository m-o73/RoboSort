const TM_URL = "https://teachablemachine.withgoogle.com/models/7Y6ziI1bb/"; 
let model, allClasses = [], correctAnswer = "", imageList = [], usedImages = [];
let currentRound = 0;
const totalRounds = 5;
let score = 0;

const quizImage = document.getElementById("quizImage");
const quizOptions = document.getElementById("quizOptions");
const quizFeedback = document.getElementById("quizFeedback");
const nextBtn = document.getElementById("nextQuestionBtn");

// Labels for quiz options
const labels = ["Pants", "Jacket", "Damaged", "T-shirt", "Shirt", "Blazer"];

// Get image list from backend
async function loadImages() {
  const res = await fetch("/api/images");  // Ensure you're using the correct endpoint
  const imageData = await res.json();
  imageList = imageData;  // Store image data with labels
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

  // Update round display
  document.getElementById("roundDisplay").textContent = `Round ${currentRound + 1} of ${totalRounds}`;
  document.getElementById("scoreDisplay").textContent = `Score: ${score}`;

  // Pick a random image from the list that hasn't been used yet
  let randomImageData;
  if (imageList.length > 0) {
    // Make sure the image picked is not used before
    let randomIndex;
    do {
      randomIndex = Math.floor(Math.random() * imageList.length);
      randomImageData = imageList[randomIndex];
    } while (usedImages.includes(randomImageData.image));  // Repeat until we find an unused image

    // Add the image to the used list
    usedImages.push(randomImageData.image);

    // Remove the image from imageList so it doesn't appear again
    imageList.splice(randomIndex, 1);
  } else {
    quizFeedback.textContent = "⚠️ All questions have been used.";
    nextBtn.style.display = "none";
    return;
  }

  quizImage.src = randomImageData.image;
  quizImage.style.display = "block";

  await new Promise(res => (quizImage.onload = res));

  // The correct answer is now directly stored in randomImageData.label
  correctAnswer = randomImageData.label;

  // Choose wrong answers from the other labels
  const wrongAnswers = labels.filter(c => c !== correctAnswer);
  const choices = [correctAnswer, ...wrongAnswers.sort(() => 0.5 - Math.random()).slice(0, 3)];

  // Shuffle choices
  choices.sort(() => 0.5 - Math.random());

  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.textContent = choice;
    btn.onclick = () => checkAnswer(choice);
    quizOptions.appendChild(btn);
  });
}

function checkAnswer(choice) {
  // Disable all buttons after selection
  const buttons = quizOptions.querySelectorAll("button");
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correctAnswer) {
      btn.style.backgroundColor = "#4CAF50"; // Green for correct
    }
    if (btn.textContent === choice && choice !== correctAnswer) {
      btn.style.backgroundColor = "#F44336"; // Red for wrong selection
    }
  });

  if (choice === correctAnswer) {
    quizFeedback.textContent = "✅ Correct!";
    quizFeedback.style.color = "lime";
    score += 100;
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
    // Game over
    quizSection.innerHTML = `
      <h2>Quiz Complete!</h2>
      <p>Your final score: ${score}/${totalRounds * 100}</p>
      <button onclick="location.reload()">Play Again</button>
    `;
  }
};

window.addEventListener("load", initQuiz);

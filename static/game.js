const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

async function fetchGameState() {
    const response = await fetch("/game_state");
    const gameState = await response.json();
    return gameState;
}

function drawPlayer(x, y) {
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fillStyle = "orange";
    ctx.fill();
    ctx.closePath();
}

function drawBoss(x, y) {
    ctx.fillStyle = "blue";
    ctx.fillRect(x - 12.5, y - 12.5, 25, 25);
}

function drawBullets(bullets, color) {
    ctx.fillStyle = color;
    bullets.forEach(bullet => {
        ctx.fillRect(bullet.x - 2, bullet.y - 2, 4, 4);
    });
}

async function renderGame() {
    const gameState = await fetchGameState();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawPlayer(gameState.player_x, gameState.player_y);
    drawBoss(gameState.boss_x, gameState.boss_y);
    drawBullets(gameState.bullets, "red");
    drawBullets(gameState.boss_bullets, "blue");

    ctx.fillStyle = "white";
    ctx.font = "20px Arial";
    ctx.fillText(`Boss Health: ${gameState.boss_health}`, 10, 30);

    requestAnimationFrame(renderGame);
}


const video = document.createElement('video');
video.autoplay = true;
video.width = 300;
video.height = 400;

async function getWebcam() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video.srcObject = stream;
    } catch (error) {
        console.error("Error accessing webcam:", error);
        return;
    }

    sendFrameToServer();
}

const originalVideo = document.getElementById('originalVideo');
const processedVideo = document.getElementById('processedVideo');

async function sendFrameToServer() {
    const canvas = document.createElement('canvas');
    canvas.width = video.width;
    canvas.height = video.height;
    const ctx = canvas.getContext('2d');

    setInterval(async () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => { // Use toBlob to get a Blob object
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg'); // Append the Blob to FormData

            try {
                const response = await fetch('/video_feed', {
                    method: 'POST',
                    body: formData // Send FormData directly
                });

                if (response.ok) {
                    const data = await response.json();
                    originalVideo.src = `data:image/jpeg;base64,${data.original}`;
                    processedVideo.src = `data:image/jpeg;base64,${data.processed}`;
                } else {
                    console.error("Error sending frame:", response.status);
                }
            } catch (error) {
                console.error("Error sending frame:", error);
            }
        }, 'image/jpeg'); // Specify image type
    }, 30);
}

getWebcam();
renderGame();
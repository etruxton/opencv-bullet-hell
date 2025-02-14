const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;

let config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    },
    parent: 'gameCanvas'
};

let game = new Phaser.Game(config);
let player;
let boss;
let bullets;
let bossBullets;
let gameState;
let originalVideo;
let processedVideo;
let prevX = 300;
let prevY = 760;
let video;

function preload() {
    // No images to load now
}

function create() {
    bullets = this.physics.add.group();
    bossBullets = this.physics.add.group();

    getGameState().then(() => {
        // Create player (orange circle)
        player = this.add.graphics();
        player.fillStyle(0xffa500, 1);
        player.fillCircle(0, 0, 10);
        player.x = gameState.player_x;
        player.y = gameState.player_y;
        this.physics.add.existing(player);

        // Create boss (blue square)
        boss = this.add.graphics();
        boss.fillStyle(0x0000ff, 1);
        boss.fillRect(-12.5, -12.5, 25, 25);
        boss.x = gameState.boss_x;
        boss.y = gameState.boss_y;
        this.physics.add.existing(boss);

        // Set up collisions (example - adapt as needed)
        this.physics.add.collider(player, bossBullets, bulletHitPlayer, null, this);

        originalVideo = document.getElementById('originalVideo');
        processedVideo = document.getElementById('processedVideo');
    });
}

function update() {
    if (!gameState || !gameState.bullets || !gameState.boss_bullets) return;

    player.x = gameState.player_x;
    player.y = gameState.player_y;

    const elapsedTime = game.loop.time - gameState.boss_start_time;
    if (elapsedTime > 10000) {
        gameState.boss_phase = gameState.boss_phase === 2 ? 1 : 2;
        gameState.boss_start_time = game.loop.time;
    }

    if (gameState.boss_phase === 1) {
        gameState.boss_x += 3 * gameState.boss_direction;
        if (gameState.boss_x <= 0 || gameState.boss_x >= GAME_WIDTH) {
            gameState.boss_direction *= -1;
        }

        if (game.loop.time - gameState.last_boss_bullet_time >= 1500) {
            let bulletGraphic = this.add.graphics();
            bulletGraphic.lineStyle(2, 0x0000ff, 1);
            bulletGraphic.strokeLineShape(new Phaser.Geom.Line(0, 0, 0, 20)); // Vertical line
            let bullet = bossBullets.create(gameState.boss_x, gameState.boss_y);
            bullet.graphic = bulletGraphic;
            gameState.boss_bullets.push(bullet);
            gameState.last_boss_bullet_time = game.loop.time;
        }
    } else if (gameState.boss_phase === 2) {
        if (game.loop.time - gameState.last_boss_bullet_time >= 1500) {
            for (let i = 0; i < 8; i++) {
                const angle = Phaser.Math.DegToRad(i * 45);
                let bulletGraphic = this.add.graphics();
                bulletGraphic.lineStyle(2, 0x0000ff, 1);
                let bullet = bossBullets.create(gameState.boss_x, gameState.boss_y);
                bullet.graphic = bulletGraphic;
                bullet.setVelocityX(Math.cos(angle) * 50);
                bullet.setVelocityY(Math.sin(angle) * 50);
                gameState.boss_bullets.push(bullet);
            }
            gameState.last_boss_bullet_time = game.loop.time;
        }
    }

    if (game.loop.time - gameState.last_bullet_time >= 200) {
        let bulletGraphic = this.add.graphics();
        bulletGraphic.lineStyle(2, 0xff0000, 1);
        bulletGraphic.strokeLineShape(new Phaser.Geom.Line(0, 0, 0, -20)); // Vertical line
        let bullet = bullets.create(gameState.player_x, gameState.player_y);
        bullet.graphic = bulletGraphic;
        gameState.bullets.push(bullet);
        gameState.last_bullet_time = game.loop.time;
    }

    bullets.getChildren().forEach(bullet => {
        bullet.graphic.clear();
        bullet.graphic.lineStyle(2, 0xff0000, 1);
        bullet.graphic.strokeLineShape(new Phaser.Geom.Line(0, 0, 0, -20));
        bullet.y -= 20;
        bullet.graphic.y = bullet.y; // Update graphic position
        bullet.graphic.x = bullet.x; // Update graphic position

        if (bullet.y < 0) {
            bullet.destroy();
            gameState.bullets.shift();
        }
    });

    bossBullets.getChildren().forEach(bullet => {
        bullet.graphic.clear();
        bullet.graphic.lineStyle(2, 0x0000ff, 1);
        if ("dx" in bullet) {
            bullet.graphic.strokeLineShape(new Phaser.Geom.Line(0, 0, bullet.dx * 10, bullet.dy * 10));
        } else {
            bullet.graphic.strokeLineShape(new Phaser.Geom.Line(0, 0, 0, 20));
        }
        bullet.x += bullet.dx || 0; // Add dx or 0 if dx is not defined
        bullet.y += bullet.dy || 5; // Add dy or 5 if dy is not defined
        bullet.graphic.x = bullet.x; // Update graphic position
        bullet.graphic.y = bullet.y; // Update graphic position


        if (bullet.y > GAME_HEIGHT || bullet.y < 0 || bullet.x > GAME_WIDTH || bullet.x < 0) {
            bullet.destroy();
            gameState.boss_bullets.shift();
        }
    });

    if (game.loop.time % 5 === 0) {
        updateGameState();
    }
}

function bulletHitPlayer(player, bullet) {
    bullet.destroy();
    // Handle player hit
}

async function getGameState() {
    const response = await fetch("/game_state");
    gameState = await response.json();
    gameState.last_boss_bullet_time = game.loop.time;
    gameState.last_bullet_time = game.loop.time;
    gameState.boss_start_time = game.loop.time;
}

async function updateGameState() {
    const response = await fetch('/update_game_state', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(gameState)
    });

    if (!response.ok) {
        console.error("Error updating game state:", response.status);
    }
}


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

async function sendFrameToServer() {
    const canvas = document.createElement('canvas');
    canvas.width = video.width;
    canvas.height = video.height;
    const ctx = canvas.getContext('2d');

    setInterval(async () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append('image', blob, 'frame.jpg');
            formData.append('prevX', prevX);
            formData.append('prevY', prevY);

            try {
                const response = await fetch('/video_feed', {
                    method: 'POST',
                    body: formData // Send the FormData object
                });

                if (response.ok) {
                    const data = await response.json();
                    originalVideo.src = `data:image/jpeg;base64,${data.original}`;
                    processedVideo.src = `data:image/jpeg;base64,${data.processed}`;

                    if (data.detected) {
                        prevX = data.x;
                        prevY = data.y;
                        gameState.player_x = data.x;
                        gameState.player_y = data.y;
                    }

                } else {
                    console.error("Error sending frame:", response.status);
                }
            } catch (error) {
                console.error("Error sending frame:", error);
            }
        }, 'image/jpeg');
    }, 30);
}

document.addEventListener('DOMContentLoaded', (event) => {
    video = document.createElement('video');
    video.autoplay = true;
    video.width = 300;
    video.height = 400;
    getWebcam(); // Call getWebcam inside the event listener
});
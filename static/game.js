const GAME_WIDTH = 600;
const GAME_HEIGHT = 800;

let config = {
    type: Phaser.AUTO,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
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
let positionBuffer = [];
let isPaused = false; // Add a variable to track pause state
let gameStarted = false; // Flag to track if the game has started
let sliderContainer; // Declare sliderContainer globally so it can be destroyed
let isDarkMode; // Keep track of the current mode
let pauseButtonContainer; 
//let hsvExplanationText;

function preload() {
    this.load.image('player', 'static/assets/images/player.png');
    this.load.image('boss', 'static/assets/images/boss.png');
    this.load.image('bossBullet', 'static/assets/images/bossBullet.png');
    this.load.image('bullet', 'static/assets/images/bullet.png');
}

document.addEventListener('DOMContentLoaded', (event) => {
    video = document.createElement('video');
    video.autoplay = true;
    video.width = 300;
    video.height = 400;
    getWebcam(); // Call getWebcam inside the event listener
});

function create() {
    // Start Menu
    //getWebcam();
    originalVideo = document.getElementById('originalVideo');
    processedVideo = document.getElementById('processedVideo');
    isDarkMode = true;
    //const startMenu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Show the start menu again
    createStartMenu.call(this);


    // Pause Button (Hidden initially)
    pauseButtonContainer = this.add.container(10, 10);
    const pauseButton = this.add.rectangle(0, 0, 100, 40, 0x888888);
    pauseButton.setInteractive({ cursor: 'pointer' }); // Add cursor pointer
    const pauseText = this.add.text(0, 0, 'Pause', { fill: '#fff' }).setOrigin(0.5);
    pauseButtonContainer.add([pauseButton, pauseText]);
    pauseText.setPosition(pauseButton.width / 2 - pauseText.width / 2, pauseButton.height / 2 - pauseText.height / 2);
    pauseButtonContainer.setInteractive();
    pauseButtonContainer.on('pointerdown', togglePause, this);
    pauseButtonContainer.setVisible(false); // Hide initially

    const escKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    escKey.on('down', togglePause, this);

    // Initialize game elements (player, boss, etc.) - moved to startGame()
    bullets = this.physics.add.group();
    bossBullets = this.physics.add.group();
    this.physics.add.existing(bossBullets);

    const worldMargin = 1;
    this.physics.world.setBounds(worldMargin, worldMargin, GAME_WIDTH - 2 * worldMargin, GAME_HEIGHT - 2 * worldMargin);

    
    startGame.call(this);
    
}

function startGame() {
    getGameState().then(() => {
        player = this.physics.add.sprite(gameState.player_x, gameState.player_y, 'player');
        player.setOrigin(0.5, 0.5);
        player.x = gameState.player_x;
        player.y = gameState.player_y;
        this.physics.add.existing(player);
        gameState.currentAngleIndex = 0;

        boss = this.physics.add.sprite(gameState.boss_x, gameState.boss_y, 'boss');
        boss.setOrigin(0.5, 0.5);
        boss.x = gameState.boss_x;
        boss.y = gameState.boss_y;
        this.physics.add.existing(boss);

        this.physics.add.collider(bullets, boss, playerBulletHitBoss, null, this);
        this.physics.add.collider(player, bossBullets, bulletHitPlayer, null, this);

        // Show pause button
        //this.children.getByName('pauseButtonContainer').setVisible(true); 
    });
}


function togglePause() {
    isPaused = !isPaused;

    if (isPaused) {
        this.physics.pause();
        this.tweens.pauseAll();
    } else {
        this.physics.resume();
        this.tweens.resumeAll();
    }
}

function createStartMenu() {
    // Start Menu
    const startMenu = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT / 2);

    hideGameSprites();

    const buttonStyle = {
        width: 200,
        height: 50,
        fillColor: 0x444444,
        textColor: '#fff'
    };

    const createButton = (yPos, text, callback) => {
        const button = this.add.rectangle(0, yPos, buttonStyle.width, buttonStyle.height, buttonStyle.fillColor);
        button.setInteractive({ cursor: 'pointer' });
        const buttonText = this.add.text(0, yPos, text, { fill: buttonStyle.textColor }).setOrigin(0.5);
        button.on('pointerdown', callback, this); // Attach callback
        return [button, buttonText]; // Return button and text
    };

    const [startGameButton, startGameText] = createButton(-100, 'Start Game', () => {
        getGameState().then(() => {  // Get game state FIRST
            if (gameState.hsv_values === undefined || gameState.hsv_values.some(isNaN)) { // Check if hsv_values is undefined or contains NaN
                startMenu.destroy();
                showCalibrationScreen.call(this); // Go to calibration if HSV values are not set
            } else {
                gameStarted = true;
                startMenu.destroy();
                positionBuffer = [];
                showGameSprites.call(this);
            }
        });
    });

    const [instructionsButton, instructionsText] = createButton(-25, 'Instructions', () => {
        console.log("Instructions clicked");
    });

    const [calibrateButton, calibrateText] = createButton(50, 'Calibrate Color', () => {
        console.log("Calibrate Color clicked");
        startMenu.destroy();
        showCalibrationScreen.call(this);
    });

    if (gameStarted) {
        showGameSprites();
    }

    startMenu.add([startGameButton, startGameText, instructionsButton, instructionsText, calibrateButton, calibrateText]);
}

function showCalibrationScreen() {
    hideGameSprites();
    sliderContainer = this.add.container(GAME_WIDTH / 2 - 150, 100);

    getGameState().then(() => {
        createSliders.call(this); // Create the sliders
        createButtons.call(this); // Create the buttons
        createHSVExplanation.call(this); // Create the HSV explanation text

        sliderContainer.add([startButton, startText, backButton, backText, modeButton, modeText, hsvExplanationText]);
    });
}


function createSliders() {
    const hsvLabels = ["Lower H", "Lower S", "Lower V", "Upper H", "Upper S", "Upper V"];

    if (gameState.hsv_values === undefined) {
        gameState.hsv_values = [0, 0, 0, 179, 255, 255];
    }

    hsvLabels.forEach((label, index) => {
        createSlider.call(this, label, gameState.hsv_values[index], index * 30, index);
    });
}

function createSlider(label, initialValue, yOffset, hsvIndex) { // Moved the createSlider function outside
    const sliderBarWidth = 200;
    const sliderBar = this.add.rectangle(0, yOffset, sliderBarWidth, 10, 0x888888);
    sliderBar.setInteractive({ cursor: 'pointer' });

    let maxValue;
    if (hsvIndex === 0 || hsvIndex === 3) { // Hue indices
        maxValue = 179;
    } else { // Saturation and Value indices
        maxValue = 255;
    }

    const initialKnobX = (initialValue / maxValue) * sliderBarWidth;
    const sliderKnob = this.add.circle(initialKnobX, yOffset, 8, 0xff0000);
    sliderKnob.setInteractive({ cursor: 'pointer', draggable: true });
    sliderKnob.input.dragX = true;

    const text = this.add.text(sliderBarWidth + 10, yOffset - 5, `${label}: ${initialValue}`, { fill: '#fff' });

    sliderContainer.add([sliderBar, sliderKnob, text]);

    sliderBar.setOrigin(0, 0.5);
    sliderKnob.setOrigin(0.5, 0.5);

    sliderKnob.on('drag', (pointer, x) => {
        let newValue = Math.round(((x - sliderBar.x) / sliderBarWidth) * maxValue);
        newValue = Math.max(0, Math.min(maxValue, newValue));
        sliderKnob.x = sliderBar.x + (newValue / maxValue) * sliderBarWidth;
        text.setText(`${label}: ${newValue}`);
        updateHSVValue(hsvIndex, newValue);
    });

    sliderBar.on('pointerdown', (pointer) => {
        let newValue = Math.round(((pointer.x - sliderBar.x) / sliderBarWidth) * maxValue);
        newValue = Math.max(0, Math.min(maxValue, newValue));
        sliderKnob.x = sliderBar.x + (newValue / maxValue) * sliderBarWidth;
        text.setText(`${label}: ${newValue}`);
        updateHSVValue(hsvIndex, newValue);
    });

    return { text, sliderBar, sliderKnob };
}

function createButtons() {
    const buttonYOffset = sliderContainer.getBounds().height + 20;

    backButton = this.add.rectangle(GAME_WIDTH - 300, buttonYOffset, 120, 40, 0x444444);
    backButton.setInteractive({ cursor: 'pointer' });
    backText = this.add.text(GAME_WIDTH - 300, buttonYOffset, 'Menu', { fill: '#fff' }).setOrigin(0.5);

    backButton.on('pointerdown', handleBackButton.bind(this)); // Use bind to keep 'this' context


    modeButton = this.add.rectangle(10, buttonYOffset, 120, 40, 0x444444);
    modeButton.setInteractive({ cursor: 'pointer' });
    modeText = this.add.text(10, buttonYOffset, 'Dark Mode', { fill: '#fff' }).setOrigin(0.5);

    modeButton.on('pointerdown', handleModeButton.bind(this)); // Use bind to keep 'this' context

    startButton = this.add.rectangle(GAME_WIDTH - 442, buttonYOffset, 120, 40, 0x444444);
    startButton.setInteractive({ cursor: 'pointer' });
    startText = this.add.text(GAME_WIDTH - 442, buttonYOffset, 'Start Game', { fill: '#fff' }).setOrigin(0.5);

    startButton.on('pointerdown', handleStartButton.bind(this)); // Use bind to keep 'this' context
}

function createHSVExplanation() {
    const buttonYOffset = sliderContainer.getBounds().height + 150;
    hsvExplanationText = this.add.text(
        GAME_WIDTH / 2 - 150,
        buttonYOffset,
        "These sliders adjust the range of colors detected by the camera.\n" +
        "Lower H, S, V: Minimum Hue, Saturation, and Value.\n" +
        "Upper H, S, V: Maximum Hue, Saturation, and Value.\n" +
        "Adjust these to isolate the colors you want to track.\n\n" +
        "Example HSV Ranges (Approximate):\n" +
        "'red': ([160, 40, 200], [180, 120, 255])\n" +
        "'yellow': ([20, 100, 100], [30, 255, 255])\n" +
        "'green': ([50, 40, 50], [90, 255, 255])\n" +
        "'blue': ([90, 50, 50], [120, 255, 255])\n" +
        "'purple': ([125, 50, 50], [140, 255, 255])\n" +
        "'white': ([0, 0, 200], [180, 255, 255])\n",
        {
            fill: '#fff',
            align: 'center',
            fontSize: 16,
            wordWrap: { width: GAME_WIDTH - 40, useAdvancedWrap: true }
        }
    ).setOrigin(0.5);

    this.add.existing(hsvExplanationText); // Add directly to the scene
}

function handleBackButton() {
    backButton.destroy();
    backText.destroy();
    startButton.destroy();
    startText.destroy();
    //hsvExplanationText.destroy(); // Destroy it

    if (sliderContainer) {
        sliderContainer.destroy(true);
        sliderContainer = null;
    }

    createStartMenu.call(this);

    if (gameStarted) {
        showGameSprites();
    }
}

function handleModeButton() {
    isDarkMode = !isDarkMode;

    const body = document.querySelector('body');
    const h1 = document.querySelector('h1');
    const gameCanvas = document.querySelector('#gameCanvas');

    if (isDarkMode) {
        body.style.backgroundColor = 'black';
        h1.style.color = 'white';
        gameCanvas.style.borderColor = 'white';
        modeText.setText('Dark Mode');
    } else {
        body.style.backgroundColor = 'white';
        h1.style.color = 'black';
        gameCanvas.style.borderColor = 'black';
        modeText.setText('Light Mode');
    }
}

function handleStartButton() {
    if (sliderContainer) {
        sliderContainer.destroy(true);
        sliderContainer = null;
    }
    startButton.destroy();
    startText.destroy();
    backButton.destroy();
    backText.destroy();
    modeButton.destroy();
    modeText.destroy();

    positionBuffer = [];

    gameStarted = true;
    showGameSprites();
}

async function updateHSVValue(hsvIndex, newValue) {
    // Assuming your gameState.hsv_values is an array of 6 values
    gameState.hsv_values[hsvIndex] = newValue;
    try {
        const response = await fetch('/update_hsv_values', {  // New route
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ hsv_values: gameState.hsv_values })
        });
        if (!response.ok) {
            console.error("Error updating HSV values:", response.status);
            // Handle error, perhaps revert the slider change or display a message
            // Example:
            // let revertedValue = gameState.hsv_values_previous[hsvIndex]; // Assuming you have a previous values array
            // if (revertedValue !== undefined) {
            //     // Find the corresponding slider and update its value and text
            //     // ... (code to find slider and update)
            // }

        } else {
          // If the update was successful, you can optionally store the current values as previous values
          gameState.hsv_values_previous = [...gameState.hsv_values]; // Create a copy
        }
    } catch (error) {
        console.error("Error updating HSV values:", error);
        // Handle error, perhaps revert the slider change or display a message
                // Example:
            // let revertedValue = gameState.hsv_values_previous[hsvIndex]; // Assuming you have a previous values array
            // if (revertedValue !== undefined) {
            //     // Find the corresponding slider and update its value and text
            //     // ... (code to find slider and update)
            // }
    }
}

function hideGameSprites() {
    if (player) player.setVisible(false);
    if (boss) boss.setVisible(false);
    // ... hide other game sprites (bullets, etc. if needed)
}

function showGameSprites() {
    if (player) player.setVisible(true);
    if (boss) boss.setVisible(true);
    // ... show other game sprites
}

function boss_phase_1() {
    gameState.boss_x += 1.5 * gameState.boss_direction;
    if (gameState.boss_x <= 0 || gameState.boss_x >= GAME_WIDTH) {
        gameState.boss_direction *= -1;
    }

    boss.x = gameState.boss_x;
    boss.y = gameState.boss_y;

    boss.body.x = boss.x - boss.width / 2;
    boss.body.y = boss.y - boss.height / 2;

    if (game.loop.time - gameState.last_boss_bullet_time >= 500) {
        let bullet = bossBullets.create(gameState.boss_x, gameState.boss_y, 'bossBullet');
        bullet.setOrigin(0.5, 0.5);

        const bulletWidth = 10;
        const bulletHeight = 10;
        bullet.body.setSize(bulletWidth, bulletHeight);
        this.physics.add.existing(bullet); // Add the bullet to the physics world.

        const speed = 200;
        bullet.setBounce(1);

        // *** SET VELOCITY IN A CALLBACK (USING A TIMER) ***
        const setBulletVelocity = () => {
            if (bullet && bullet.body) {
                bullet.setVelocityY(speed);
            } else {
                // Try again after a short delay
                game.time.addEvent({
                    delay: 10, // Try every 10 milliseconds
                    callback: setBulletVelocity,
                    callbackScope: this // Important: set the callback scope
                });
            }
        };

        setBulletVelocity(); // Call the function to start the check

        gameState.boss_bullets.push(bullet);
        gameState.last_boss_bullet_time = game.loop.time;
    }
}

function boss_phase_2() {
    if (game.loop.time - gameState.last_boss_bullet_time >= 200) { // Check every 0.5 seconds (500ms)
        const spawnPoints = [
            { x: 200, y: 1 },
            { x: 400, y: 1 }
        ];

        const angles = [150, 120, 90, 60, 30]; // Array of angles
        const currentAngleIndex = gameState.currentAngleIndex || 0; // Keep track of the current angle

        for (const spawnPoint of spawnPoints) {
            let bullet = bossBullets.create(spawnPoint.x, spawnPoint.y, 'bossBullet');
            bullet.setOrigin(0.5, 0.5);

            const bulletWidth = 10;
            const bulletHeight = 10;
            bullet.body.setSize(bulletWidth, bulletHeight);
            this.physics.add.existing(bullet);

            bullet.setBounce(1);

            const setBulletVelocity = () => {
                if (bullet && bullet.body) {
                    const angle = Phaser.Math.DegToRad(angles[currentAngleIndex]);

                    const speed = 200; // Keep speed constant
                    const vx = speed * Math.cos(angle);
                    const vy = speed * Math.sin(angle);

                    bullet.setVelocity(vx, vy);
                    bullet.off('addedtoscene', setBulletVelocity);
                } else {
                    game.time.addEvent({
                        delay: 10,
                        callback: setBulletVelocity,
                        callbackScope: this
                    });
                }
            };

            setBulletVelocity();
            gameState.boss_bullets.push(bullet);
        }

        // Increment the angle index for the next bullet
        gameState.currentAngleIndex = (currentAngleIndex + 1) % angles.length; // Loop back to 0
        gameState.last_boss_bullet_time = game.loop.time;
    }
}

function boss_phase_3() {
    gameState.boss_x -= 0.5 * gameState.boss_direction;
    if (gameState.boss_x <= 0 || gameState.boss_x >= GAME_WIDTH) {
        gameState.boss_direction *= -1;
    }

    boss.x = gameState.boss_x;
    boss.y = gameState.boss_y;

    boss.body.x = boss.x - boss.width / 2;
    boss.body.y = boss.y - boss.height / 2;

    if (game.loop.time - gameState.last_boss_bullet_time >= 1500) {
        const numBullets = 10;
        for (let i = 0; i < numBullets; i++) {
            const angle = Phaser.Math.DegToRad(i * (360 / numBullets));

            let bullet = bossBullets.create(gameState.boss_x, gameState.boss_y, 'bossBullet');
            bullet.setOrigin(0.5, 0.5);

            const bulletWidth = 10;
            const bulletHeight = 10;
            bullet.body.setSize(bulletWidth, bulletHeight);
            this.physics.add.existing(bullet); // Add the bullet to the physics world.

            bullet.setBounce(1);
            bullet.body.setCollideWorldBounds(true);

            const speed = 250;

            // *** SET VELOCITY IN A CALLBACK (USING A TIMER) ***
            const setBulletVelocity = () => {
                if (bullet && bullet.body) {
                    const vx = Math.cos(angle) * speed;
                    const vy = Math.sin(angle) * speed;
                    bullet.setVelocity(vx, vy);
                } else {
                    // Try again after a short delay
                    game.time.addEvent({
                        delay: 10, // Try every 10 milliseconds
                        callback: setBulletVelocity,
                        callbackScope: this // Important: set the callback scope
                    });
                }
            };

            setBulletVelocity();// Call the function to start the check
            bullet.bounceCount = 3;

            gameState.boss_bullets.push(bullet);
        }
        gameState.last_boss_bullet_time = game.loop.time;
    }
}

function update() {
    if (!gameStarted) { hideGameSprites(); return }; // Don't update if the game hasn't started
    if (isPaused) return; // If paused, exit the update function early

    if (!gameState || !gameState.bullets || !gameState.boss_bullets) return;

    //pauseButtonContainer.setVisible(true); // Show the pause button

    if (positionBuffer.length > 0) {
        const nextPosition = positionBuffer.shift(); // Get the oldest update
        movePlayer.call(this, nextPosition.x, nextPosition.y);
    }
    player.body.x = player.x - player.width / 2;
    player.body.y = player.y - player.height / 2;

    const elapsedTime = game.loop.time - gameState.boss_start_time;
    const phaseChangeInterval = 8000;

    if (elapsedTime > phaseChangeInterval) {
        let randomPhase;
        do {
            randomPhase = Phaser.Math.Between(1, 3);
        } while (randomPhase === gameState.boss_phase);

        console.log("Changing phase to", randomPhase);
        gameState.boss_phase = randomPhase;
        gameState.boss_start_time = game.loop.time;
    }

    if (gameState.boss_phase === 1) {
        boss_phase_1.call(this);
    } else if (gameState.boss_phase === 2) {
        boss_phase_2.call(this);
    } else if (gameState.boss_phase === 3) {
        boss_phase_3.call(this);
    }

    if (game.loop.time - gameState.last_bullet_time >= 200) {
        createBullet.call(this); // Call the new bullet creation function
        gameState.last_bullet_time = game.loop.time;
    }

    bossBullets.getChildren().forEach(bullet => {
        const outOfBoundsMargin = 2;

        if (
            bullet.y > GAME_HEIGHT + outOfBoundsMargin ||
            bullet.y < -outOfBoundsMargin ||
            bullet.x > GAME_WIDTH + outOfBoundsMargin ||
            bullet.x < -outOfBoundsMargin
        ) {
            bullet.destroy();
            gameState.boss_bullets = gameState.boss_bullets.filter(b => b !== bullet);
        }

        // *** BOUNCE COUNT LOGIC (for phase 3 bullets) ***
        if (gameState.boss_phase === 3) { // Only apply to phase 3 bullets
            if (bullet.bounceCount === undefined) { // Check if bounceCount is undefined
                bullet.bounceCount = 3; // Initialize if it's a "new" phase 3 bullet
            }
            if (bullet.bounceCount > 0 && bullet.body && bullet.body.onWall()) {  //Check bullet.body here as well
                bullet.bounceCount--;
            } else if (bullet.bounceCount <= 0 && bullet.body && bullet.body.onWall()) { //Check bullet.body here as well
                bullet.destroy();
                gameState.boss_bullets = gameState.boss_bullets.filter(b => b !== bullet);
            }
        }
        else if (bullet.body && bullet.body.onWall()) {
            bullet.destroy();
            gameState.boss_bullets = gameState.boss_bullets.filter(b => b !== bullet);
        }
    });

    if (game.loop.time % 5 === 0) {
        updateGameState();
    }
}

function createBullet() {
    let bullet = bullets.create(gameState.player_x, gameState.player_y, 'bullet');
    bullet.setOrigin(0.5, 1);
    gameState.bullets.push(bullet);

    const targetY = -bullet.height;

    bullet.body.allowGravity = false;
    bullet.body.setVelocity(0, 0);

    const distance = Math.abs(targetY - gameState.player_y); // Calculate the distance
    const speed = 1000; // Pixels per second (adjust as needed)
    const duration = distance / speed * 1000; // Calculate duration based on speed

    this.tweens.add({
        targets: bullet,
        y: targetY,
        duration: duration, // Use calculated duration
        ease: 'Linear',
        onComplete: () => {
            gameState.bullets = gameState.bullets.filter(b => b !== bullet);
            bullet.destroy();
        }
    });

    return bullet;
}

function bulletHitPlayer(player, bullet) {
    // 1. Destroy the bullet object
    bullet.destroy();
    // 2. Remove the bullet from gameState.boss_bullets
    gameState.boss_bullets = gameState.boss_bullets.filter(b => b !== bullet);
    // 3. Destroy the bullet's graphic
    if (bullet.graphic) { // Check if the graphic exists (important!)
        bullet.graphic.destroy();
    }
    // ... other logic (e.g., player health -= 10;)
    console.log("Player hit!");
}

function playerBulletHitBoss(boss, bullet) { // Correct order: boss, bullet
    bullet.destroy(); // Destroy the player's bullet
    gameState.bullets = gameState.bullets.filter(b => b !== bullet); // Remove bullet from array
    // Optional: Add boss hit logic here (e.g., reduce boss health)
    console.log("Boss hit!");
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
        //console.error("Error accessing webcam:", error);
        return;
    }

    sendFrameToServer();
}

function movePlayer(newX, newY) {
    if (player && this.tweens) {  // Check if player and tweens exist
        this.tweens.add({
            targets: player,
            x: newX,
            y: newY,
            duration: 100, // Adjust duration for smoothness
            ease: 'Linear', // Or other easing function
            overwrite: true,
            yoyo: false,
            repeat: 0,
            onUpdate: () => { // Update physics body during tween
                player.body.x = player.x - player.width / 2;
                player.body.y = player.y - player.height / 2;
            },
            onComplete: () => {
                gameState.player_x = newX;
                gameState.player_y = newY;
            }
        });
    } else {
      //console.log('Player or tweens not available yet.'); //Helpful for debugging
    }
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
                        positionBuffer.push({ x: data.x, y: data.y });
                        prevX = data.x;
                        prevY = data.y;
                    }

                } else {
                    //console.error("Error sending frame:", response.status);
                }
            } catch (error) {
                //console.error("Error sending frame:", error);
            }
        }, 'image/jpeg');
    }, 30);
}


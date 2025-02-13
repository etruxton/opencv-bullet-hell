from flask import Flask, render_template, request, jsonify
import threading
import pygame
import random
import time
import math
import cv2
import numpy as np
import base64

app = Flask(__name__)

# Set the maximum content length (adjust as needed)

pygame.init()

WIDTH, HEIGHT = 905, 800
GAME_WIDTH, GAME_HEIGHT = 600, 800
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Orange Ball")

WHITE = (255, 255, 255)
RED = (255, 0, 0)
BLUE = (0, 0, 255)
ORANGE = (255, 165, 0)
BLACK = (0, 0, 0)

game_state = {
    "player_x": GAME_WIDTH // 2,
    "player_y": GAME_HEIGHT - 40,
    "boss_x": GAME_WIDTH // 2,
    "boss_y": 20,
    "boss_health": 10,
    "bullets": [],
    "boss_bullets": [],
    "running": True,
}

prev_cX, prev_cY = game_state["player_x"], game_state["player_y"]

def player_movement(cX, cY):
    global prev_cX, prev_cY
    prev_cX, prev_cY = cX, cY
    return cX, cY

def game_loop():
    global game_state
    clock = pygame.time.Clock()

    while game_state["running"]:
        clock = pygame.time.Clock()
        last_boss_bullet_time = time.time()
        last_bullet_time = time.time()
        boss_phase = 1
        boss_start_time = time.time()
        boss_direction = 1

        while game_state["running"]:
            cX, cY = player_movement(prev_cX, prev_cY)
            game_state["player_x"] = cX
            game_state["player_y"] = cY

            elapsed_time = time.time() - boss_start_time
            if elapsed_time > 10:
                boss_phase = 1 if boss_phase == 2 else 2
                boss_start_time = time.time()

            if boss_phase == 1:
                game_state["boss_x"] += 3 * boss_direction
                if game_state["boss_x"] <= 0 or game_state["boss_x"] >= GAME_WIDTH:
                    boss_direction *= -1

                if time.time() - last_boss_bullet_time >= 1.5:
                    game_state["boss_bullets"].append({"x": game_state["boss_x"], "y": game_state["boss_y"]})
                    last_boss_bullet_time = time.time()

            elif boss_phase == 2:
                if time.time() - last_boss_bullet_time >= 1.5:
                    for i in range(8):
                        angle = math.radians(i * 45)
                        game_state["boss_bullets"].append({
                            "x": game_state["boss_x"],
                            "y": game_state["boss_y"],
                            "dx": math.cos(angle) * 5,
                            "dy": math.sin(angle) * 5,
                        })
                    last_boss_bullet_time = time.time()

            current_time = time.time()
            if current_time - last_bullet_time >= 0.2:
                game_state["bullets"].append({"x": game_state["player_x"], "y": game_state["player_y"]})
                last_bullet_time = current_time

            for bullet in game_state["bullets"][:]:
                bullet["y"] -= 20
                if bullet["y"] < 0:
                    game_state["bullets"].remove(bullet)

            for boss_bullet in game_state["boss_bullets"][:]:
                if "dx" in boss_bullet:
                    boss_bullet["x"] += boss_bullet["dx"]
                    boss_bullet["y"] += boss_bullet["dy"]
                else:
                    boss_bullet["y"] += 5

                if boss_bullet["y"] > HEIGHT or boss_bullet["y"] < 0 or boss_bullet["x"] > WIDTH or boss_bullet["x"] < 0:
                    game_state["boss_bullets"].remove(boss_bullet)

            clock.tick(60)

threading.Thread(target=game_loop, daemon=True).start()


@app.route("/")
def index():
    return render_template("index.html")

@app.route('/video_feed', methods=['POST'])
@app.route('/video_feed', methods=['POST'])
def video_feed():
    if 'image' not in request.files:
        return jsonify({'error': 'No image part'}), 400

    image_file = request.files['image']
    if image_file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        nparr = np.frombuffer(image_file.read(), np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        frame = cv2.flip(frame, 1)
        frame = cv2.resize(frame, (GAME_WIDTH, GAME_HEIGHT), interpolation=cv2.INTER_AREA)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)

        lower_orange = np.array([0, 0, 195])
        upper_orange = np.array([179, 255, 255])
        mask = cv2.inRange(hsv, lower_orange, upper_orange)
        res = cv2.bitwise_and(frame, frame, mask=mask)

        M = cv2.moments(mask)

        cX = None  # Initialize cX and cY to None
        cY = None

        if M["m00"] != 0:
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            cv2.circle(res, (cX, cY), 5, (0, 0, 255), -1)  # Draw circle only if object detected
            player_movement(cX, cY)  # Update player position only if object detected

        else:  # Object NOT detected
            cX = prev_cX # Use previous coordinates
            cY = prev_cY
            player_movement(cX, cY)  # Still update the player position so it doesnt get stuck
            # You could optionally draw a visual cue (e.g., text) on 'res' here if you want.
            cv2.putText(res, "No object detected", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            cv2.circle(res, (cX, cY), 5, (0, 0, 255), -1)  # Draw circle only if object detected


        ret, jpeg_original = cv2.imencode('.jpg', frame)  # Encode original frame ALWAYS
        original_video = jpeg_original.tobytes()
        original_base64 = base64.b64encode(original_video).decode('utf-8')

        ret, jpeg_processed = cv2.imencode('.jpg', res)  # Encode processed frame ALWAYS
        processed_video = jpeg_processed.tobytes()
        processed_base64 = base64.b64encode(processed_video).decode('utf-8')


        return jsonify({
            'message': 'Frame received',
            'original': original_base64,
            'processed': processed_base64
        }), 200

    except Exception as e:
        print(f"Error processing image: {e}")
        return jsonify({'error': 'Error processing image: {str(e)}'}), 500  # Include error message


@app.route("/game_state")
def get_game_state():
    return jsonify(game_state)  # Return game_state as JSON


if __name__ == "__main__":
    app.run(debug=True, threaded=True)
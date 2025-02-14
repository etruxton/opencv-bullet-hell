from flask import Flask, render_template, request, jsonify, session
import threading
import random
import time
import math
import cv2
import numpy as np
import base64
import os

app = Flask(__name__)
app.secret_key = os.urandom(24)  # VERY IMPORTANT: Set a strong secret key

GAME_WIDTH, GAME_HEIGHT = 600, 800

def create_game_state():  # Function to create a game state
    return {
        "player_x": GAME_WIDTH // 2,
        "player_y": GAME_HEIGHT - 40,
        "prev_cX": GAME_WIDTH // 2,  # Store previous coordinates here
        "prev_cY": GAME_HEIGHT - 40,
    }

#def player_movement(session, cX, cY):  # Now takes session as an argument
#    session['game_state']["prev_cX"], session['game_state']["prev_cY"] = cX, cY
#    return cX, cY

@app.route("/")
def index():
    return render_template("index.html")

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

        game_state = session['game_state']
        prevX = int(request.form.get('prevX')) #Retrieve previous x and y from the request
        prevY = int(request.form.get('prevY'))

        if M["m00"] != 0:  # Object detected
            cX = int(M["m10"] / M["m00"])
            cY = int(M["m01"] / M["m00"])
            game_state['player_x'] = cX
            game_state['player_y'] = cY
            cv2.circle(res, (cX, cY), 5, (0, 0, 255), -1)
            print(f"Object detected at ({cX}, {cY})")

            ret, jpeg_original = cv2.imencode('.jpg', frame) #Original Frame
            original_video = jpeg_original.tobytes()
            original_base64 = base64.b64encode(original_video).decode('utf-8')

            ret, jpeg_processed = cv2.imencode('.jpg', res) #Processed Frame
            processed_video = jpeg_processed.tobytes()
            processed_base64 = base64.b64encode(processed_video).decode('utf-8')

            return jsonify({
                'message': 'Frame received',
                'original': original_base64,
                'processed': processed_base64,
                'detected': True, 
                'x': cX, 
                'y': cY
            })

        else:  # Object NOT detected
            print("No Object detected")

            cv2.putText(res, "No object detected", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)
            
            cX = prevX  # Use previous coordinates
            cY = prevY
            cv2.circle(res, (cX, cY), 5, (0, 0, 255), -1)  # Draw circle at previous coordinates
            ret, jpeg_original = cv2.imencode('.jpg', frame) #Original Frame
            original_video = jpeg_original.tobytes()
            original_base64 = base64.b64encode(original_video).decode('utf-8')

            ret, jpeg_processed = cv2.imencode('.jpg', res) #Processed Frame
            processed_video = jpeg_processed.tobytes()
            processed_base64 = base64.b64encode(processed_video).decode('utf-8')


            return jsonify({
                'message': 'Frame received',
                'original': original_base64,
                'processed': processed_base64,
                'detected': False
            })

    except Exception as e:
        print(f"Error processing image: {e}")
        return jsonify({'error': 'Error processing image: {str(e)}'}), 500

@app.route("/game_state")
def get_game_state():
    if 'game_state' not in session:
        session['game_state'] = create_game_state()  # Create game state on first request
    return jsonify(session['game_state'])  # Return game_state as JSON

if __name__ == "__main__":
    app.run(debug=True, threaded=True)
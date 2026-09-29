import zmq
import json

# Create ZMQ context and socket
context = zmq.Context()
socket = context.socket(zmq.REQ)

# Connect to the listener on port 5556
socket.connect("tcp://127.0.0.1:5556")

# Create test message with ID number 877878787878
test_message = {
    "type": "REGISTRATION_RESULT",
    "id_number": "877878787878",
    "status": "REGISTERED",
    "message": "Face registration completed successfully"
}

print(f"[TEST] Sending message to ZMQ listener on port 5556...")
print(f"[TEST] Message: {json.dumps(test_message, indent=2)}")

# Send the message
socket.send_json(test_message)

# Wait for acknowledgment
response = socket.recv_json()
print(f"[TEST] Received response: {response}")

socket.close()
context.term()
print("[TEST] Test complete!")

import zmq
import time
import threading
import random

# -----------------------------
# Configuration
# -----------------------------
GATEWAY_COMMAND_PORT = "tcp://127.0.0.1:5555"   # Gateway → Pipeline
GATEWAY_CALLBACK_PORT = "tcp://127.0.0.1:5556"  # Pipeline → Gateway

# -----------------------------
# Global state
# -----------------------------
PIPELINE_RUNNING = False

context = zmq.Context()

# -----------------------------
# Command Listener
# -----------------------------
def command_listener():
    global PIPELINE_RUNNING

    socket = context.socket(zmq.REP)
    socket.bind(GATEWAY_COMMAND_PORT)

    print("[PIPELINE] Command listener started on 5555")

    while True:
        msg = socket.recv_json()
        print(f"[PIPELINE] Command received: {msg}")

        if msg.get("command") == "START_PIPELINE":
            PIPELINE_RUNNING = True
            print("[PIPELINE] Pipeline STARTED")
            socket.send_json({"ack": True})

        elif msg.get("command") == "STOP_PIPELINE":
            PIPELINE_RUNNING = False
            print("[PIPELINE] Pipeline STOPPED")
            socket.send_json({"ack": True})

        else:
            print("[PIPELINE] Unknown command")
            socket.send_json({"ack": False})


# -----------------------------
# Registration Processor
# -----------------------------
def simulate_registration(id_number: str):
    if not PIPELINE_RUNNING:
        print(f"[PIPELINE] ❌ Registration ignored (pipeline stopped): {id_number}")
        return

    print(f"[PIPELINE] 🧠 Processing registration for {id_number}")
    time.sleep(random.randint(1, 3))  # simulate inference time

    status = random.choice(["REGISTERED", "FAILED"])

    callback_socket = context.socket(zmq.REQ)
    callback_socket.connect(GATEWAY_CALLBACK_PORT)

    payload = {
        "type": "REGISTRATION_RESULT",
        "id_number": id_number,
        "status": status,
        "message": "Simulated pipeline response"
    }

    print(f"[PIPELINE] ➡ Sending result to gateway: {payload}")
    callback_socket.send_json(payload)
    ack = callback_socket.recv_json()

    print(f"[PIPELINE] ⬅ Gateway ACK: {ack}")


# -----------------------------
# Registration Listener
# -----------------------------
def registration_listener():
    socket = context.socket(zmq.REP)
    socket.bind("tcp://0.0.0.0:5557")  # Gateway → Pipeline registration port

    print("[PIPELINE] Registration listener started on 5557")

    while True:
        msg = socket.recv_json()
        print(f"[PIPELINE] Registration request received: {msg}")

        socket.send_json({"ack": True})

        id_number = msg.get("id_number")
        if id_number:
            threading.Thread(
                target=simulate_registration,
                args=(id_number,),
                daemon=True
            ).start()


# -----------------------------
# Main
# -----------------------------
if __name__ == "__main__":
    print("======================================")
    print("   SMG FACE PIPELINE – SIMULATOR")
    print("======================================")

    threading.Thread(target=command_listener, daemon=True).start()
    threading.Thread(target=registration_listener, daemon=True).start()

    while True:
        time.sleep(1)

import zmq
from app.db.mongo import users_collection, verification_collection
from app.services.verification_service import update_verification_result
from datetime import datetime
import threading

def start_zmq_listener():
    context = zmq.Context()
    socket = context.socket(zmq.PULL)
    socket.bind("tcp://0.0.0.0:5556")  # pipeline connects here

    print("[ZMQ] Listening for pipeline callbacks...")

    while True:
        try:
            msg = socket.recv_json()

            if msg.get("type") == "REGISTRATION_RESULT":
                users_collection.update_one(
                    {"id_number": msg["id_number"]},
                    {
                        "$set": {
                            "status": msg["status"],
                            "updated_at": datetime.utcnow(),
                            "pipeline_message": msg.get("message"),
                        }
                    },
                )
                socket.send_json({"ack": True})

            elif msg.get("type") == "VERIFICATION_RESULT":
                request_id = msg.get("request_id")
                update_verification_result(request_id, msg)
                socket.send_json({"ack": True})
            
            else:
                socket.send_json({"ack": False})
        except Exception as e:
            print(f"[ZMQ] Error in listener: {e}")
            socket.send_json({"ack": False, "error": str(e)})

def start_all_listeners():
    """Start ZMQ listener for pipeline callbacks"""
    callback_listener_thread = threading.Thread(target=start_zmq_listener, daemon=True)
    callback_listener_thread.start()

    print("[ZMQ] Callback listener started on port 5556")
    
    # Keep main thread alive
    try:
        while True:
            threading.Event().wait(1)
    except KeyboardInterrupt:
        print("[ZMQ] Shutting down listeners...")

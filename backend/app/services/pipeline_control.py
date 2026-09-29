import zmq

def start_pipeline():
    context = zmq.Context()

    socket = context.socket(zmq.REQ)
    socket.connect("tcp://127.0.0.1:5555")

    socket.send_json({
        "command": "START_PIPELINE"
    })

    # REQUIRED for REQ socket
    response = socket.recv_json()

    socket.close()
    context.term()

    return response

def stop_pipeline():
    context = zmq.Context()

    socket = context.socket(zmq.REQ)
    socket.connect("tcp://127.0.0.1:5555")

    socket.send_json({
        "command": "STOP_PIPELINE"
    })

    # REQUIRED for REQ socket
    response = socket.recv_json()

    socket.close()
    context.term()

    return response
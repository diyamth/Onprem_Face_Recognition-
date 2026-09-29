import zmq
import json

context = zmq.Context()
socket = context.socket(zmq.REQ)
socket.connect("tcp://127.0.0.1:5555")  # pipeline address

def send_registration(payload: dict):
    socket.send_json(payload)
    response = socket.recv_json()
    return response

def send_verification(payload: dict):
    """Send verification request to pipeline"""
    socket.send_json(payload)
    response = socket.recv_json()
    return response

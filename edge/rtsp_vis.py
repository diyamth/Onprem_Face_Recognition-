import zmq
import cv2
import numpy as np
from datetime import datetime
import base64
from typing import Dict, Optional

class RTSPVisualizationClient:
    """Client that receives identification results and frame data to display visualizations"""
    
    def __init__(self, zmq_pull_port: int = 5557):
        self.zmq_pull_port = zmq_pull_port
        
        # ZMQ setup for receiving results
        self.context = zmq.Context()
        self.pull_socket = self.context.socket(zmq.PULL)
        self.pull_socket.connect(f"tcp://localhost:{zmq_pull_port}")
        
        # Display state
        self.running = False
        self.latest_frame = None
        self.latest_result = None
        self.result_timestamp = None
        self.frames_buffer = {}
        self.results_buffer = {}
        
        print(f"[Visualization] Connected to ZMQ PULL on port {zmq_pull_port}")
        print(f"[Visualization] Waiting for frames and results...")
    
    def base64_to_image(self, base64_string: str) -> Optional[np.ndarray]:
        """Convert base64 string to OpenCV image"""
        try:
            if ',' in base64_string:
                base64_string = base64_string.split(',')[1]
            
            img_data = base64.b64decode(base64_string)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            return img
        except Exception as e:
            print(f"[Error] Failed to decode base64 image: {e}")
            return None
    
    def draw_warning(self, frame: np.ndarray, warning_type: str, face_count: int = 0) -> np.ndarray:
        """Draw warning on top-left corner in red"""
        height, width = frame.shape[:2]
        
        # Red background for warning
        cv2.rectangle(frame, (10, 10), (min(400, width-10), 80), (0, 0, 255), -1)
        cv2.rectangle(frame, (10, 10), (min(400, width-10), 80), (255, 255, 255), 2)
        
        # Warning text
        if warning_type == "NO_FACE_DETECTED":
            text = "WARNING: No Face Detected"
        elif warning_type == "MULTIPLE_FACES_DETECTED":
            text = f"WARNING: {face_count} Faces Detected"
        else:
            text = f"WARNING: {warning_type}"
        
        cv2.putText(frame, text, (20, 50), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return frame
    
    def draw_authorized_user(self, frame: np.ndarray, result: Dict) -> np.ndarray:
        """Draw green bounding box for authorized user with valid license (>10 days)"""
        face_box = result.get('face_box')
        if not face_box:
            return frame
        
        x = face_box['x']
        y = face_box['y']
        w = face_box['w']
        h = face_box['h']
        
        # Ensure coordinates are within frame bounds
        height, width = frame.shape[:2]
        x = max(0, min(x, width - 1))
        y = max(0, min(y, height - 1))
        w = min(w, width - x)
        h = min(h, height - y)
        
        # Check if authorized and license valid (>10 days)
        authorized = result.get('authorized', False)
        days_until_expiry = result.get('days_until_expiry')
        license_status = result.get('license_status', 'unknown')
        
        if authorized and (days_until_expiry is None or days_until_expiry > 10):
            # Green box for authorized with valid license
            color = (0, 255, 0)
            thickness = 3
            
            # Draw bounding box
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)
            
            # Info box above face
            name = result.get('name', 'Unknown')
            id_number = result.get('id_number', 'N/A')
            similarity = result.get('similarity_score', 0.0)
            
            # Background for text
            text_bg_height = 80
            text_y = max(text_bg_height, y)
            cv2.rectangle(frame, (x, text_y - text_bg_height), (x + w, text_y), (0, 200, 0), -1)
            cv2.rectangle(frame, (x, text_y - text_bg_height), (x + w, text_y), (255, 255, 255), 2)
            
            # User info
            cv2.putText(frame, f"ID: {id_number}", (x + 5, text_y - 55), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, f"Name: {name}", (x + 5, text_y - 35), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, f"Match: {similarity:.2%}", (x + 5, text_y - 15), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            
            # Status indicator (top-right corner)
            status_text = "AUTHORIZED"
            cv2.rectangle(frame, (width - 250, 10), (width - 10, 60), (0, 255, 0), -1)
            cv2.rectangle(frame, (width - 250, 10), (width - 10, 60), (255, 255, 255), 2)
            cv2.putText(frame, status_text, (width - 230, 45), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2)
        
        elif authorized and license_status == "expiring_soon":
            # Yellow box for expiring soon
            color = (0, 255, 255)
            thickness = 3
            
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)
            
            # Warning about expiring license
            text_y = max(60, y)
            cv2.rectangle(frame, (x, text_y - 60), (x + w, text_y), (0, 200, 200), -1)
            cv2.putText(frame, f"License expires in {days_until_expiry} days", 
                       (x + 5, text_y - 35), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
            cv2.putText(frame, result.get('name', 'Unknown'), 
                       (x + 5, text_y - 15), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
        else:
            # Red box for unauthorized
            color = (0, 0, 255)
            thickness = 3
            
            cv2.rectangle(frame, (x, y), (x + w, y + h), color, thickness)
            
            # Unauthorized message
            message = result.get('message', 'Unauthorized')
            text_y = max(50, y)
            cv2.rectangle(frame, (x, text_y - 50), (x + w, text_y), (0, 0, 200), -1)
            cv2.putText(frame, "UNAUTHORIZED", (x + 5, text_y - 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
            cv2.putText(frame, message[:30], (x + 5, text_y - 10), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
            
            # Status indicator
            cv2.rectangle(frame, (width - 250, 10), (width - 10, 60), (0, 0, 255), -1)
            cv2.rectangle(frame, (width - 250, 10), (width - 10, 60), (255, 255, 255), 2)
            cv2.putText(frame, "ACCESS DENIED", (width - 230, 45), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        
        return frame
    
    def draw_timestamp(self, frame: np.ndarray):
        """Draw timestamp on bottom-left corner"""
        height, width = frame.shape[:2]
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        cv2.rectangle(frame, (10, height - 40), (280, height - 10), (0, 0, 0), -1)
        cv2.putText(frame, timestamp, (15, height - 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    def process_message(self, message: Dict):
        msg_type = message.get('type', '')

        if msg_type == 'frame':
            frame_id = message.get("frame_id")
            frame_base64 = message.get("frame_data")

            if frame_id and frame_base64:
                frame = self.base64_to_image(frame_base64)
                if frame is not None:
                    self.frames_buffer[frame_id] = frame

        elif msg_type == 'identification':
            frame_id = message.get("frame_id")
            if frame_id:
                self.results_buffer[frame_id] = message

        elif msg_type == 'warning':
            self.latest_result = message
    
    def create_display_frame(self) -> Optional[np.ndarray]:
        if not self.frames_buffer:
            placeholder = np.zeros((480, 640, 3), dtype=np.uint8)
            cv2.putText(placeholder, "Waiting for frames...", (150, 240),
                        cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
            return placeholder

        # Always show latest frame
        latest_frame_id = sorted(self.frames_buffer.keys())[-1]
        frame = self.frames_buffer[latest_frame_id].copy()

        # If we have result for same frame, draw it
        result = self.results_buffer.get(latest_frame_id)

        if result and result.get("type") == "identification":
            frame = self.draw_authorized_user(frame, result)

        self.draw_timestamp(frame)
        return frame
    
    def start(self):
        """Start the visualization loop"""
        self.running = True
        
        print("[Visualization] Ready to display")
        print("[Visualization] Press 'q' to quit")
        
        cv2.namedWindow('Face Recognition - RTSP Stream', cv2.WINDOW_NORMAL)
        
        while self.running:
            try:
                # Non-blocking receive with timeout
                if self.pull_socket.poll(100):  # 100ms timeout
                    message = self.pull_socket.recv_json()
                    self.process_message(message)
                
                # Create and display frame
                display_frame = self.create_display_frame()
                if display_frame is not None:
                    cv2.imshow('Face Recognition - RTSP Stream', display_frame)
                
                # Check for quit
                key = cv2.waitKey(1) & 0xFF
                if key == ord('q'):
                    print("[Visualization] Quit requested")
                    break
                    
            except KeyboardInterrupt:
                print("\n[Visualization] Interrupted")
                break
            except Exception as e:
                print(f"[Error] {e}")
                continue
        
        # Cleanup
        self.stop()
    
    def stop(self):
        """Stop visualization"""
        self.running = False
        cv2.destroyAllWindows()
        self.pull_socket.close()
        self.context.term()
        print("[Visualization] Stopped")


if __name__ == "__main__":
    # Configuration
    ZMQ_PULL_PORT = 5557
    
    # Create and start visualization client
    client = RTSPVisualizationClient(zmq_pull_port=ZMQ_PULL_PORT)
    
    try:
        client.start()
    except KeyboardInterrupt:
        print("\n[Shutdown] Stopping visualization...")
        client.stop()
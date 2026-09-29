import zmq
import cv2
import numpy as np
import base64
import faiss
import time
import pickle
from retinaface import RetinaFace
from deepface import DeepFace
from typing import List, Optional, Dict, Tuple
import os
from datetime import datetime, timedelta
from pymongo import MongoClient
from pathlib import Path
import json
import threading
import queue

class FaissIndexManager:
    """Manages FAISS index and ID mappings"""
    
    def __init__(self, index_path="faiss_data", dimension=512):
        self.dimension = dimension
        self.index_path = Path(index_path)
        self.index_path.mkdir(exist_ok=True)
        
        self.index_file = self.index_path / "face_index.faiss"
        self.mapping_file = self.index_path / "id_mapping.pkl"
        
        self.index = None
        self.id_mapping = []
        
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize or load FAISS index"""
        if self.index_file.exists() and self.mapping_file.exists():
            print("[FAISS] Loading existing index...")
            self.load_index()
        else:
            print("[FAISS] Creating new index...")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_mapping = []
            self.save_index()
    
    def add_embedding(self, embedding: List[float], id_number: str) -> bool:
        """Add new embedding to FAISS index"""
        try:
            embedding_array = np.array([embedding], dtype=np.float32)
            self.index.add(embedding_array)
            self.id_mapping.append(id_number)
            self.save_index()
            print(f"[FAISS] Added embedding for ID: {id_number} (Total: {len(self.id_mapping)})")
            return True
        except Exception as e:
            print(f"[FAISS Error] Failed to add embedding: {e}")
            return False
    
    def search(self, embedding: np.ndarray, k: int = 1, threshold: float = 0.5) -> List[Dict]:
        """Search for similar embeddings using cosine similarity"""
        try:
            if self.index.ntotal == 0:
                print("[FAISS] Index is empty. No matches.")
                return []

            embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
            scores, indices = self.index.search(embedding, k)

            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:
                    continue

                score = float(score)

                if score >= threshold:
                    results.append({
                        "id_number": self.id_mapping[idx],
                        "similarity": score
                    })
                    print(f"[FAISS] Match found - ID: {self.id_mapping[idx]}, Similarity: {score:.4f}")
                else:
                    print(f"[FAISS] Closest ID: {self.id_mapping[idx]}, Similarity: {score:.4f} (Below threshold {threshold})")

            return results

        except Exception as e:
            print(f"[FAISS Error] Search failed: {e}")
            return []

    def save_index(self):
        """Save FAISS index and mappings to disk"""
        try:
            faiss.write_index(self.index, str(self.index_file))
            with open(self.mapping_file, 'wb') as f:
                pickle.dump(self.id_mapping, f)
            print(f"[FAISS] Index saved ({self.index.ntotal} vectors)")
        except Exception as e:
            print(f"[FAISS Error] Failed to save: {e}")
    
    def load_index(self):
        """Load FAISS index and mappings from disk"""
        try:
            self.index = faiss.read_index(str(self.index_file))
            with open(self.mapping_file, 'rb') as f:
                self.id_mapping = pickle.load(f)
            print(f"[FAISS] Index loaded ({self.index.ntotal} vectors)")
        except Exception as e:
            print(f"[FAISS Error] Failed to load: {e}")
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_mapping = []
    
    def rebuild_from_mongodb(self, users_collection):
        """Rebuild FAISS index from MongoDB"""
        try:
            print("[FAISS] Rebuilding index from MongoDB...")
            
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_mapping = []
            
            users = users_collection.find({"embedding": {"$exists": True}})
            
            count = 0
            for user in users:
                if user.get("embedding"):
                    embedding = user["embedding"]
                    id_number = user["id_number"]
                    
                    embedding_array = np.array([embedding], dtype=np.float32)
                    self.index.add(embedding_array)
                    self.id_mapping.append(id_number)
                    count += 1
            
            self.save_index()
            print(f"[FAISS] Rebuilt index with {count} embeddings")
            return True
        except Exception as e:
            print(f"[FAISS Error] Rebuild failed: {e}")
            return False


class FaceProcessor:
    """Handles face detection and embedding generation"""
    
    def __init__(self, temp_dir="temp_faces", warning_socket=None):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
        self.warning_socket = warning_socket
    
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
    
    def send_warning(self, warning_type: str, message: str, face_count: int = 0, frame_data: dict = None):
        """Send warning through ZMQ socket"""
        try:
            payload = {
                "type": "warning",
                "code": warning_type,
                "face_count": face_count,
                "message": message,
                "timestamp": datetime.utcnow().isoformat()
            }
            if frame_data:
                payload.update(frame_data)
            
            self.warning_socket.send_json(payload)
            print(f"[ZMQ] Sent warning: {warning_type}")
        except Exception as e:
            print(f"[ZMQ Error] Failed to send warning: {e}")

    def process_frame(self, frame: np.ndarray, frame_id: str) -> Tuple[Optional[List[float]], str, Optional[dict]]:
        """
        Process frame: detect faces and generate embedding
        Returns: (embedding, message, face_box_info)
        """
        temp_path = None
        
        try:
            # Save temp image
            temp_path = self.temp_dir / f"{frame_id}_temp.jpg"
            cv2.imwrite(str(temp_path), frame)
            
            # Generate embedding
            print(f"[Processing] Generating embedding for frame: {frame_id}")
            embedding_objs: List[dict] = DeepFace.represent(
                img_path=str(temp_path),
                model_name="ArcFace",
                detector_backend='retinaface',
                enforce_detection=True,
                align=True
            )

            if not embedding_objs:
                self.send_warning("NO_FACE_DETECTED", "No face detected in frame", 0)
                return None, "No face detected", None

            # Multiple faces detected
            if len(embedding_objs) > 1:
                self.send_warning("MULTIPLE_FACES_DETECTED", 
                                f"{len(embedding_objs)} faces detected in frame", 
                                len(embedding_objs))
                return None, "Multiple faces detected", None
            
            # Single face - extract embedding and bounding box
            embedding = embedding_objs[0]['embedding']
            facial_area = embedding_objs[0].get('facial_area', {})
            
            face_box = {
                'x': facial_area.get('x', 0),
                'y': facial_area.get('y', 0),
                'w': facial_area.get('w', 0),
                'h': facial_area.get('h', 0)
            }
            
            print(f"[Success] Processed frame: {frame_id}")
            return embedding, "Success", face_box
            
        except Exception as e:
            error_msg = str(e)
            if "Face could not be detected" in error_msg:
                self.send_warning("NO_FACE_DETECTED", "No face detected in frame", 0)
                return None, "No face detected", None
            
            print(f"[Error] Processing failed for {frame_id}: {e}")
            return None, error_msg, None
        
        finally:
            if temp_path and temp_path.exists():
                temp_path.unlink()


class RTSPStreamProcessor:
    """Handles RTSP stream capture and frame processing"""
    
    def __init__(self, rtsp_url: str, frame_skip: int = 5, processing_callback=None):
        self.rtsp_url = rtsp_url
        self.frame_skip = frame_skip
        self.processing_callback = processing_callback
        self.running = False
        self.cap = None
        self.frame_count = 0
        
    def start(self):
        """Start RTSP stream processing in a separate thread"""
        self.running = True
        self.thread = threading.Thread(target=self._process_stream, daemon=True)
        self.thread.start()
        print(f"[RTSP] Started processing stream: {self.rtsp_url}")
    
    def stop(self):
        """Stop RTSP stream processing"""
        self.running = False
        if self.cap:
            self.cap.release()
        print("[RTSP] Stopped stream processing")
    
    def _process_stream(self):
        """Main loop for processing RTSP stream"""
        try:
            self.cap = cv2.VideoCapture(self.rtsp_url)
            
            if not self.cap.isOpened():
                print(f"[RTSP Error] Failed to open stream: {self.rtsp_url}")
                return
            
            print(f"[RTSP] Stream opened successfully")
            
            while self.running:
                ret, frame = self.cap.read()
                
                if not ret:
                    print("[RTSP] Failed to read frame, reconnecting...")
                    time.sleep(1)
                    self.cap.release()
                    self.cap = cv2.VideoCapture(self.rtsp_url)
                    continue
                
                self.frame_count += 1
                
                # Process every Nth frame
                if self.frame_count % self.frame_skip == 0:
                    if self.processing_callback:
                        self.processing_callback(frame, self.frame_count)
                
        except Exception as e:
            print(f"[RTSP Error] Stream processing error: {e}")
        finally:
            if self.cap:
                self.cap.release()


class UnifiedFacePipeline:
    """Unified pipeline that handles registration and RTSP stream identification"""
    
    def __init__(self, mongo_uri: str, db_name: str, collection_name: str,
                 zmq_port: int = 5555, push_port: int = 5556, 
                 similarity_threshold: float = 0.5, frame_skip: int = 5):

        # MongoDB setup
        self.mongo_client = MongoClient(mongo_uri)
        self.db = self.mongo_client[db_name]
        self.users_collection = self.db[collection_name]

        # FAISS setup
        self.faiss_manager = FaissIndexManager()

        # Configuration
        self.similarity_threshold = similarity_threshold
        self.frame_skip = frame_skip

        # ZMQ context
        self.context = zmq.Context()

        # ZMQ REP socket (for incoming requests)
        self.socket = self.context.socket(zmq.REP)
        self.socket.bind(f"tcp://0.0.0.0:{zmq_port}")

        # ZMQ PUSH socket (for results/warnings)
        # self.push_socket = self.context.socket(zmq.PUSH)
        # self.push_socket.bind(f"tcp://0.0.0.0:{push_port}")

        # Face processor
        self.face_processor = FaceProcessor(warning_socket=self.socket)

        # RTSP processor (will be created when identification starts)
        self.rtsp_processor = None

        print(f"[Unified Pipeline] Listening (REP) on port {zmq_port}")
        print(f"[Unified Pipeline] Pushing (PUSH) on port {push_port}")
        print(f"[Unified Pipeline] Similarity threshold: {similarity_threshold}")
        print(f"[Unified Pipeline] Frame skip: {frame_skip}")

        # Rebuild FAISS index from MongoDB on startup
        print("[Startup] Rebuilding FAISS index from MongoDB...")
        self.faiss_manager.rebuild_from_mongodb(self.users_collection)
        print("[Startup] Pipeline ready!")

    def image_to_base64(self, img: np.ndarray) -> str:
        """Convert OpenCV image to base64"""
        _, buffer = cv2.imencode('.jpg', img)
        return base64.b64encode(buffer).decode('utf-8')

    def handle_registration(self, payload: Dict) -> Dict:
        """Handle registration request"""
        try:
            name = payload.get("name")
            id_number = payload.get("id_number")
            license_expiry = payload.get("license_expiry")
            face_image_base64 = payload.get("face_image")

            if not all([name, id_number, face_image_base64]):
                return {
                    "type": "REGISTRATION_RESULT",
                    "status": "FAILED",
                    "id_number": id_number,
                    "message": "Missing required fields (name, id_number, face_image)"
                }

            # Check if user already exists
            existing_user = self.users_collection.find_one({"id_number": id_number})
            if existing_user:
                return {
                    "type": "REGISTRATION_RESULT",
                    "status": "FAILED",
                    "id_number": id_number,
                    "message": f"User with ID {id_number} already registered"
                }

            # Process face from base64 image
            img = self.face_processor.base64_to_image(face_image_base64)
            if img is None:
                return {
                    "type": "REGISTRATION_RESULT",
                    "status": "FAILED",
                    "id_number": id_number,
                    "message": "Failed to decode image"
                }

            # Generate embedding
            temp_path = self.face_processor.temp_dir / f"{id_number}_reg_temp.jpg"
            cv2.imwrite(str(temp_path), img)
            
            try:
                embedding_objs = DeepFace.represent(
                    img_path=str(temp_path),
                    model_name="ArcFace",
                    detector_backend='retinaface',
                    enforce_detection=True,
                    align=True
                )
                
                if not embedding_objs:
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "message": "No face detected"
                    }

                if len(embedding_objs) > 1:
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "message": "Multiple faces detected"
                    }
                
                embedding = embedding_objs[0]['embedding']
                
            finally:
                if temp_path.exists():
                    temp_path.unlink()

            # L2 normalize
            embedding = np.array(embedding, dtype=np.float32)
            embedding = embedding / np.linalg.norm(embedding)

            # Prepare user document
            user_document = {
                "name": name,
                "id_number": id_number,
                "license_expiry": license_expiry,
                "embedding": embedding.tolist(),
                "status": "active",
                "registered_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }

            # Store in MongoDB
            self.users_collection.insert_one(user_document)
            
            # Add to FAISS
            faiss_success = self.faiss_manager.add_embedding(embedding, id_number)

            print(f"[Registration] Successfully registered: {id_number}")

            return {
                "type": "REGISTRATION_RESULT",
                "status": "REGISTERED",
                "message": "User registered successfully",
                "id_number": id_number,
                "name": name,
                "faiss_indexed": faiss_success
            }

        except Exception as e:
            print(f"[Registration Error] {e}")
            return {
                "type": "REGISTRATION_RESULT",
                "status": "FAILED",
                "id_number": payload.get("id_number"),
                "message": str(e)
            }

    def process_identification_frame(self, frame: np.ndarray, frame_id: int):
        """Process a single frame for identification"""
        try:
            # ============ SEND FRAME FIRST ============
            frame_base64 = self.image_to_base64(frame)

            frame_payload = {
            "type": "frame",
            "frame_id": frame_id,
            "frame_data": frame_base64,
            "timestamp": datetime.utcnow().isoformat()
        }

            self.push_socket.send_json(frame_payload)
            print(f"[DEBUG] Frame event pushed for frame {frame_id}")

            # Process face
            embedding, message, face_box = self.face_processor.process_frame(
                frame, f"frame_{frame_id}"
            )

            # Skip if no face or multiple faces (warning already sent)
            if not embedding:
                return

            # L2 normalize
            embedding = np.array(embedding, dtype=np.float32)
            norm = np.linalg.norm(embedding)
            if norm == 0:
                return
            embedding = embedding / norm

            # Search in FAISS
            matches = self.faiss_manager.search(
                embedding=embedding,
                k=1,
                threshold=self.similarity_threshold
            )

            if not matches:
                result = {
                    "type": "identification",
                    "status": "unauthorized",
                    "message": "Unknown person",
                    "authorized": False,
                    "frame_id": frame_id,
                    "face_box": face_box,
                    "timestamp": datetime.utcnow().isoformat()
                }
                self.push_socket.send_json(result)
                return

            # Best match
            best_match = matches[0]
            id_number = best_match["id_number"]
            similarity_score = float(best_match["similarity"])

            # Fetch user from MongoDB
            user = self.users_collection.find_one({"id_number": id_number})

            if not user:
                return

            # Check license expiry
            license_expired = False
            license_status = "valid"
            days_until_expiry = None

            if user.get("license_expiry"):
                try:
                    license_expiry = user["license_expiry"]
                    if isinstance(license_expiry, str):
                        expiry_date = datetime.fromisoformat(license_expiry.replace('Z', '+00:00'))
                    else:
                        expiry_date = license_expiry

                    now = datetime.utcnow()
                    days_until_expiry = (expiry_date - now).days
                    
                    if days_until_expiry < 0:
                        license_expired = True
                        license_status = "expired"
                    elif days_until_expiry <= 10:
                        license_status = "expiring_soon"
                    
                except Exception as e:
                    print(f"[Warning] Failed to parse license expiry: {e}")
                    license_status = "unknown"

            authorized = (not license_expired) and (user.get("status") == "active")

            result = {
                "type": "identification",
                "status": "identified",
                "authorized": authorized,
                "id_number": id_number,
                "name": user.get("name"),
                "license_expiry": user.get("license_expiry"),
                "license_status": license_status,
                "days_until_expiry": days_until_expiry,
                "license_expired": license_expired,
                "similarity_score": round(similarity_score, 4),
                "user_status": user.get("status", "unknown"),
                "frame_id": frame_id,
                "face_box": face_box,
                "message": self._get_identification_message(authorized, license_expired, license_status),
                "timestamp": datetime.utcnow().isoformat()
            }

            print(f"[ID] Frame {frame_id}: {id_number} ({user.get('name')}) | Sim: {similarity_score:.4f} | {result['message']}")

            # Push result
            self.push_socket.send_json(result)

        except Exception as e:
            print(f"[Identification Error] Frame {frame_id}: {e}")

    def _get_identification_message(self, authorized: bool, license_expired: bool, license_status: str) -> str:
        """Generate appropriate identification message"""
        if not authorized:
            if license_expired:
                return "Access denied - License expired"
            elif license_status == "expiring_soon":
                return "Access granted - License expiring soon"
            else:
                return "Access denied"
        return "Access granted"

    def handle_identification(self, payload: Dict) -> Dict:
        """Handle identification request - start RTSP stream processing"""
        try:
            rtsp_link = payload.get("rtsp_link")

            if not rtsp_link:
                return {
                    "mode": "identification",
                    "status": "failed",
                    "message": "No RTSP link provided"
                }

            # Stop existing RTSP processor if running
            if self.rtsp_processor and self.rtsp_processor.running:
                self.rtsp_processor.stop()

            # Create and start new RTSP processor
            self.rtsp_processor = RTSPStreamProcessor(
                rtsp_url=rtsp_link,
                frame_skip=self.frame_skip,
                processing_callback=self.process_identification_frame
            )
            
            self.rtsp_processor.start()

            print(f"[Identification] Started RTSP stream processing: {rtsp_link}")

            return {
                "mode": "identification",
                "status": "started",
                "message": "RTSP stream processing started",
                "rtsp_link": rtsp_link,
                "frame_skip": self.frame_skip
            }

        except Exception as e:
            print(f"[Identification Error] {e}")
            return {
                "mode": "identification",
                "status": "failed",
                "message": str(e)
            }

    def process_request(self, payload: Dict) -> Dict:
        """Route request based on mode"""
        mode = payload.get("mode", "").lower()
        
        if mode == "registration":
            print(f"\n{'='*60}")
            print(f"[Request] Mode: REGISTRATION | ID: {payload.get('id_number', 'N/A')}")
            print(f"{'='*60}")
            return self.handle_registration(payload)
        
        elif mode == "identification":
            print(f"\n{'='*60}")
            print(f"[Request] Mode: IDENTIFICATION (RTSP)")
            print(f"{'='*60}")
            return self.handle_identification(payload)
        
        elif mode == "stop_identification":
            if self.rtsp_processor:
                self.rtsp_processor.stop()
                return {
                    "mode": "stop_identification",
                    "status": "success",
                    "message": "RTSP stream processing stopped"
                }
            return {
                "mode": "stop_identification",
                "status": "failed",
                "message": "No active RTSP stream"
            }
        
        else:
            return {
                "status": "error",
                "message": f"Invalid mode: {mode}. Expected 'registration', 'identification', or 'stop_identification'"
            }
    
    def start_listening(self):
        """Main loop for processing requests"""
        print("\n" + "="*60)
        print("UNIFIED FACE RECOGNITION PIPELINE (RTSP)")
        print("="*60)
        print("Ready to process requests...")
        print("Supported modes: 'registration', 'identification', 'stop_identification'")
        print("="*60 + "\n")
        
        while True:
            try:
                payload = self.socket.recv_json()
                response = self.process_request(payload)
                self.socket.send_json(response)
                
            except KeyboardInterrupt:
                print("\n[Shutdown] Stopping pipeline...")
                break
            except Exception as e:
                print(f"[Pipeline Error] {e}")
                try:
                    self.socket.send_json({
                        "status": "error",
                        "message": f"Pipeline error: {str(e)}"
                    })
                except:
                    pass
        
        # Cleanup
        print("[Cleanup] Closing connections...")
        if self.rtsp_processor:
            self.rtsp_processor.stop()
        self.socket.close()
        self.push_socket.close()
        self.context.term()
        self.mongo_client.close()
        print("[Shutdown] Pipeline stopped successfully")


# Main runner
if __name__ == "__main__":
    MONGO_URI = "mongodb://localhost:27017/"
    DB_NAME = "face_recognition"
    COLLECTION_NAME = "users"
    ZMQ_PORT = 5555
    PUSH_PORT = 5556
    SIMILARITY_THRESHOLD = 0.5
    FRAME_SKIP = 5  # Process every 5th frame
    
    pipeline = UnifiedFacePipeline(
        mongo_uri=MONGO_URI,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        zmq_port=ZMQ_PORT,
        push_port=PUSH_PORT,
        similarity_threshold=SIMILARITY_THRESHOLD,
        frame_skip=FRAME_SKIP
    )
    
    pipeline.start_listening()
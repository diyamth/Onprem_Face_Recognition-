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
from datetime import datetime
from pymongo import MongoClient
from pathlib import Path
import json

class FaissIndexManager:
    """Manages FAISS index and ID mappings"""
    
    def __init__(self, index_path="faiss_data", dimension=512):
        self.dimension = dimension
        # self.index_path = Path(index_path)
        # self.index_path.mkdir(exist_ok=True)
        
        # self.index_file = self.index_path / "face_index.faiss"
        # self.mapping_file = self.index_path / "id_mapping.pkl"
        
        self.index = None
        self.id_mapping = []  # List of id_numbers corresponding to index positions
        
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize or load FAISS index"""
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
            # self.save_index()
            print(f"[FAISS] Added embedding for ID: {id_number} (Total: {len(self.id_mapping)})")
            return True
        except Exception as e:
            print(f"[FAISS Error] Failed to add embedding: {e}")
            return False
    
    def search(self, embedding: np.ndarray, k: int = 1, threshold: float = 0.6) -> List[Dict]:
        """
        Search for similar embeddings using cosine similarity (Inner Product on normalized vectors)
        Args:
            embedding: L2-normalized embedding vector (numpy array)
            k: number of nearest neighbors
            threshold: cosine similarity threshold (0.0 - 1.0, higher = more similar)
        Returns:
            List of matches with id_number and similarity score
        """
        try:
            if self.index.ntotal == 0:
                print("[FAISS] Index is empty. No matches.")
                return []

            # Ensure correct shape
            embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)

            # FAISS search (Inner Product = cosine similarity for normalized vectors)
            scores, indices = self.index.search(embedding, k)

            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx == -1:
                    continue

                score = float(score)  # 🔥 ensure JSON-serializable

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
        
    def l2_normalize(vec):
        vec = np.array(vec, dtype=np.float32)
        norm = np.linalg.norm(vec)
        if norm == 0:
            return vec
        return vec / norm

    def remove_embedding(self, id_number: str) -> bool:
        """Remove embedding from index (requires rebuild)"""
        try:
            if id_number in self.id_mapping:
                # FAISS doesn't support direct removal, so rebuild without this ID
                idx = self.id_mapping.index(id_number)
                self.id_mapping.pop(idx)
                print(f"[FAISS] Removed ID: {id_number}, rebuilding index...")
                return True
            return False
        except Exception as e:
            print(f"[FAISS Error] Failed to remove: {e}")
            return False
    
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
            
            # Create new index
            self.index = faiss.IndexFlatIP(self.dimension)
            self.id_mapping = []
            
            # Fetch all users with embeddings
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

    def __init__(self, temp_dir="temp_faces"):
        self.temp_dir = Path(temp_dir)
        self.temp_dir.mkdir(exist_ok=True)
    
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
    
    def image_to_base64(self, img: np.ndarray) -> Optional[str]:
        """Convert OpenCV image to base64 string"""
        try:
            _, buffer = cv2.imencode('.jpg', img)
            img_base64 = base64.b64encode(buffer).decode('utf-8')
            return img_base64
        except Exception as e:
            print(f"[Error] Failed to encode image to base64: {e}")
            return None

    def process_face(self, face_image_base64: str, identifier: str) -> Tuple[Optional[str], Optional[List[float]], str]:
        """
        Process face: detect, crop, and generate embedding
        Returns: (cropped_face_base64, embedding, message)
        """
        temp_path = None
        # crop_path = None
        
        try:
            # Decode image
            img = self.base64_to_image(face_image_base64)
            if img is None:
                return None, None, "Failed to decode image"
            
            # Save temp image
            temp_path = self.temp_dir / f"{identifier}_temp.jpg"
            cv2.imwrite(str(temp_path), img)
            
            # Generate embedding
            print(f"[Processing] Generating embedding for: {identifier}")
            embedding_objs: List[dict] = DeepFace.represent(
                img_path=str(temp_path),
                model_name="ArcFace",
                detector_backend='retinaface',
                enforce_detection=True,
                align=True
            )

            if not embedding_objs:
                return None, None, "No face detected"

            # If more than 1 face detected → reject (production rule)
            if len(embedding_objs) > 1:
                print(f"[Warning] Multiple faces detected for {identifier}: {len(embedding_objs)} faces")
                return None, None, f"Multiple faces detected ({len(embedding_objs)} faces)"
            
            # if not embedding_objs or len(embedding_objs) == 0:
            #     return None, None, "Failed to generate embedding"
            
            embedding = embedding_objs[0]['embedding']
            return None, embedding, "Success"
            # cropped_face_base64 = self.image_to_base64(face_crop)
            
            # print(f"[Success] Processed face for: {identifier}")
            # return cropped_face_base64, embedding, "Success"
            
        except Exception as e:
            print(f"[Error] Processing failed for {identifier}: {e}")
            return None, None, str(e)
        
        finally:
            # Cleanup temp files
            if temp_path and temp_path.exists():
                temp_path.unlink()
            # if crop_path and crop_path.exists():
            #     crop_path.unlink()


class UnifiedFacePipeline:
    """Unified pipeline that handles both registration and identification"""
    
    def __init__(self, mongo_uri: str, db_name: str, collection_name: str,
             zmq_port: int = 5555, similarity_threshold: float = 0.5):

        # MongoDB setup
        self.mongo_client = MongoClient(mongo_uri)
        self.db = self.mongo_client[db_name]
        self.users_collection = self.db[collection_name]

        # FAISS setup
        self.faiss_manager = FaissIndexManager()

        # Configuration
        self.similarity_threshold = similarity_threshold

        # ZMQ context (shared)
        self.context = zmq.Context()

        # ZMQ REP socket (for incoming requests)
        self.socket = self.context.socket(zmq.REP)
        self.socket.bind(f"tcp://0.0.0.0:{zmq_port}")

        # Face processor
        self.face_processor = FaceProcessor()

        print(f"[Unified Pipeline] Listening (REQ-REP) on port {zmq_port}")
        print(f"[Unified Pipeline] Similarity threshold: {similarity_threshold}")

        # Rebuild FAISS index from MongoDB on startup
        print("[Startup] FAISS index is empty (fresh start)")
        # self.faiss_manager.rebuild_from_mongodb(self.users_collection)
        # print("[Startup] Pipeline ready!")

    def handle_registration(self, payload: Dict) -> Dict:
            """Handle registration request with face-duplicate protection"""
    
            try:
                # ==============================
                # 1. Extract fields
                # ==============================
                name = payload.get("name")
                id_number = payload.get("id_number")
                license_expiry = payload.get("license_expiry")
                role = payload.get("role", "DRIVER")
                face_image_base64 = payload.get("face_image")
                vendor_name = payload.get("vendor_name", "")
    
                if not all([name, id_number, face_image_base64, role, vendor_name]):
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,
                        "vendor_name": vendor_name,
                        "message": "Missing required fields (name, id_number, face_image, role, vendor_name)"
                    }
    
                # ==============================
                # 2. ID-based duplicate check
                # ==============================
                if self.users_collection.find_one({"id_number": id_number}):
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,   
                        "message": f"User with ID {id_number} already exists"
                    }
    
                # ==============================
                # 3. Decode image
                # ==============================
                img = self.face_processor.base64_to_image(face_image_base64)
                if img is None:
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,
                        "message": "Failed to decode image"
                    }
    
                # ==============================
                # 4. Generate embedding (SAFE)
                # ==============================
                temp_path = self.face_processor.temp_dir / f"{id_number}_reg_temp.jpg"
    
                embedding = None
                try:
                    cv2.imwrite(str(temp_path), img)
    
                    embedding_objs = DeepFace.represent(
                        img_path=str(temp_path),
                        model_name="ArcFace",
                        detector_backend="retinaface",
                        enforce_detection=True,
                        align=True
                    )
    
                    if not embedding_objs:
                        return {
                            "type": "REGISTRATION_RESULT",
                            "status": "FAILED",
                            "id_number": id_number,
                            "role": role,
                            "message": "No face detected"
                        }
    
                    if len(embedding_objs) > 1:
                        return {
                            "type": "REGISTRATION_RESULT",
                            "status": "FAILED",
                            "id_number": id_number,
                            "role": role,
                            "message": "Multiple faces detected"
                        }
    
                    embedding = np.array(
                        embedding_objs[0]["embedding"], dtype=np.float32
                    )
    
                except Exception as e:
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,
                        "message": f"Face embedding failed: {str(e)}"
                    }
    
                finally:
                    if temp_path.exists():
                        temp_path.unlink()
    
                # ==============================
                # 5. Normalize embedding
                # ==============================
                norm = np.linalg.norm(embedding)
                if norm == 0:
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,
                        "message": "Invalid embedding (zero norm)"
                    }
    
                embedding = embedding / norm
    
                # ==============================
                # 6. Face duplicate check (FAISS)
                # ==============================
                matches = self.faiss_manager.search(embedding=embedding, k=1, threshold=0.6)
            
                if not matches:
                    pass
                else:
                    best_match = matches[0]
                    return {
                        "type": "REGISTRATION_RESULT",
                        "status": "FAILED",
                        "id_number": id_number,
                        "role": role,
                        "message": (
                            f"Face already registered "
                            f"(matched ID: {best_match['id_number']}, "
                            f"similarity={best_match['similarity']:.2f})"
                        )
                    }

                # ==============================
                # 7. Store in MongoDB
                # ==============================
                user_document = {
                    "name": name,
                    "id_number": id_number,
                    "role": role,
                    "license_expiry": license_expiry,
                    "embedding": embedding.tolist(),
                    "model_name": "ArcFace",
                    "detector_backend": "retinaface",
                    "status": "active",
                    "vendor_name": vendor_name,
                    "registered_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
    
                self.users_collection.insert_one(user_document)
    
                # ==============================
                # 8. Add to FAISS
                # ==============================
                faiss_success = self.faiss_manager.add_embedding(embedding, id_number)
    
                print(f"[Registration] Registered {id_number} ({role})")
    
                return {
                    "type": "REGISTRATION_RESULT",
                    "status": "REGISTERED",
                    "id_number": id_number,
                    "name": name,
                    "role": role,
                    "vendor_name": vendor_name,
                    "faiss_indexed": faiss_success
                }
    
            except Exception as e:
                print(f"[Registration Error] {e}")
                return {
                    "type": "REGISTRATION_RESULT",
                    "status": "FAILED",
                    "id_number": payload.get("id_number"),
                    "role": payload.get("role", "DRIVER"),
                    "vendor_name": payload.get("vendor_name"),
                    "message": str(e)
                }
 
     
    def handle_identification(self, payload: Dict) -> Dict:
        """Handle identification request (production-grade cosine similarity)"""
        try:
            request_id = payload.get("request_id")
            video_frame_base64 = payload.get("video_frame") or payload.get("face_image")

            if not video_frame_base64:
                return {
                    "type": "VERIFICATION_RESULT",
                    "mode": "identification",
                    "request_id": request_id,
                    "status": "failed",
                    "message": "No video frame or face image provided",
                    "authorized": False,
                    "match": False
                }

            # Process face
            print(f"[Identification] Processing video frame...")
            _, embedding, message = self.face_processor.process_face(
                video_frame_base64, f"identify_{datetime.utcnow().timestamp()}"
            )

            if not embedding:
                return {
                    "type": "VERIFICATION_RESULT",
                    "mode": "identification",
                    "request_id": request_id,
                    "status": "no_face_detected",
                    "message": message,
                    "authorized": False,
                    "match": False
                }

            # 🔥 L2 NORMALIZE (MANDATORY)
            embedding = np.array(embedding, dtype=np.float32)
            norm = np.linalg.norm(embedding)
            if norm == 0:
                raise ValueError("Zero-norm embedding encountered")
            embedding = embedding / norm

            print("[DEBUG] About to start FAISS cosine search...")
            t0 = time.time()

            # Search in FAISS (cosine similarity)
            matches = self.faiss_manager.search(
                embedding=embedding,
                k=1,
                threshold=self.similarity_threshold
            )

            print(f"[DEBUG] FAISS search completed in {time.time() - t0:.4f} seconds")

            if not matches:
                return {
                    "type": "VERIFICATION_RESULT",
                    "mode": "identification",
                    "request_id": request_id,
                    "status": "unauthorized",
                    "message": "No matching person found in database",
                    "authorized": False,
                    "match": False
                }

            # Best match
            best_match = matches[0]
            id_number = best_match["id_number"]
            similarity_score = float(best_match["similarity"])

            # Fetch user from MongoDB
            user = self.users_collection.find_one({"id_number": id_number})

            if not user:
                return {
                    "type": "VERIFICATION_RESULT",
                    "mode": "identification",
                    "request_id": request_id,
                    "status": "error",
                    "message": "User found in FAISS but not in database",
                    "authorized": False,
                    "match": False
                }

            # Check license expiry
            license_expired = False
            license_status = "valid"

            if user.get("license_expiry"):
                try:
                    license_expiry = user["license_expiry"]
                    if isinstance(license_expiry, str):
                        expiry_date = datetime.fromisoformat(license_expiry.replace('Z', '+00:00'))
                    else:
                        expiry_date = license_expiry

                    if expiry_date < datetime.utcnow():
                        license_expired = True
                        license_status = "expired"
                except Exception as e:
                    print(f"[Warning] Failed to parse license expiry: {e}")
                    license_status = "unknown"

            authorized = (not license_expired) and (user.get("status") == "active")

            result = {
                "type": "VERIFICATION_RESULT",
                "mode": "identification",
                "request_id": request_id,
                "status": "identified",
                "authorized": authorized,
                "match": True,
                "confidence": round(similarity_score, 4),
                "id_number": id_number,
                "name": user.get("name"),
                "role": user.get("role", "UNKNOWN"),
                "vendor_name": user.get("vendor_name", ""),
                "license_expiry": user.get("license_expiry"),
                "license_status": license_status,
                "license_expired": license_expired,
                "similarity_score": round(similarity_score, 4),
                "user_status": user.get("status", "unknown"),
                "message": self._get_identification_message(authorized, license_expired, user.get("status"))
            }

            print(f"[Identification] Identified: {id_number} ({user.get('name')}) | Similarity: {similarity_score:.4f} | {result['message']}")

            return result

        except Exception as e:
            print(f"[Identification Error] {e}")
            return {
                "type": "VERIFICATION_RESULT",
                "mode": "identification",
                "request_id": payload.get("request_id"),
                "status": "error",
                "message": str(e),
                "authorized": False,
                "match": False
            }

    def _get_identification_message(self, authorized: bool, license_expired: bool, user_status: str) -> str:
        """Generate appropriate identification message"""
        if not authorized:
            if license_expired:
                return "Access denied - License expired"
            elif user_status != "active":
                return f"Access denied - User status: {user_status}"
            else:
                return "Access denied"
        return "Access granted - Authorized"
    
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
            print(f"[Request] Mode: IDENTIFICATION")
            print(f"{'='*60}")
            return self.handle_identification(payload)
        
        else:
            return {
                "status": "error",
                "message": f"Invalid mode: {mode}. Expected 'registration' or 'identification'"
            }
    
    def start_listening(self):
        """Main loop for processing requests"""
        print("\n" + "="*60)
        print("UNIFIED FACE RECOGNITION PIPELINE")
        print("="*60)
        print("Ready to process requests...")
        print("Supported modes: 'registration', 'identification'")
        print("="*60 + "\n")
        
        while True:
            try:
                # Receive request
                payload = self.socket.recv_json()
                
                # Process request based on mode
                response = self.process_request(payload)
                
                # Send response
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
        self.socket.close()
        self.context.term()
        self.mongo_client.close()
        print("[Shutdown] Pipeline stopped successfully")


# Main runner
if __name__ == "__main__":
    # Configuration
    MONGO_URI = "mongodb://localhost:27017/"
    DB_NAME = "face_recognition"
    COLLECTION_NAME = "users"
    ZMQ_PORT = 5555
    SIMILARITY_THRESHOLD = 0.5  # Lower = stricter matching

    # Start unified pipeline
    pipeline = UnifiedFacePipeline(
        mongo_uri=MONGO_URI,
        db_name=DB_NAME,
        collection_name=COLLECTION_NAME,
        zmq_port=ZMQ_PORT,
        similarity_threshold=SIMILARITY_THRESHOLD
    )
    
    pipeline.start_listening()
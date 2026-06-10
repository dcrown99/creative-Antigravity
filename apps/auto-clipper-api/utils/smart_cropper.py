import cv2
import numpy as np
try:
    import mediapipe as mp
    HAS_MEDIAPIPE = True
except ImportError:
    HAS_MEDIAPIPE = False
    print("Warning: MediaPipe not found. Using OpenCV fallback for face detection.")

def get_crop_coordinates(video_path: str, start_time: float, end_time: float, target_ratio: float = 9/16):
    """
    Analyzes the video segment to determine the best crop coordinates to keep the face centered.
    Returns a function or list of coordinates for dynamic cropping.
    """
    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))

    

    
    start_frame = int(start_time * fps)
    end_frame = int(end_time * fps)
    
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    
    face_centers = []
    timestamps = []
    
    # Initialize Face Detection
    face_detection = None
    face_cascade = None
    
    if HAS_MEDIAPIPE:
        mp_face_detection = mp.solutions.face_detection
        face_detection = mp_face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)
    else:
        # Load Haar Cascade for fallback
        # OpenCV usually comes with these xml files. We can try to load default.
        # If not found, we might need to download it or just use center crop.
        cascade_path = cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        face_cascade = cv2.CascadeClassifier(cascade_path)
        if face_cascade.empty():
            print("Warning: Could not load Haar Cascade. Fallback to center crop.")
            face_cascade = None

    try:
        curr_frame = start_frame
        while curr_frame < end_frame:
            success, image = cap.read()
            if not success:
                break
                
            # Process every nth frame to speed up (e.g., every 5th frame)
            if (curr_frame - start_frame) % 5 == 0:
                
                center_x = None
                
                if HAS_MEDIAPIPE and face_detection:
                    image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
                    results = face_detection.process(image_rgb)
                    
                    if results.detections:
                        # Find the largest face
                        largest_face = None
                        max_area = 0
                        for detection in results.detections:
                            bboxC = detection.location_data.relative_bounding_box
                            area = bboxC.width * bboxC.height
                            if area > max_area:
                                max_area = area
                                largest_face = bboxC
                        
                        if largest_face:
                            center_x = (largest_face.xmin + largest_face.width / 2) * width

                elif face_cascade:
                    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
                    faces = face_cascade.detectMultiScale(gray, 1.1, 4)
                    if len(faces) > 0:
                        # Find largest face
                        largest_face = max(faces, key=lambda rect: rect[2] * rect[3])
                        (x, y, w, h) = largest_face
                        center_x = x + w / 2
                
                if center_x is not None:
                    face_centers.append(center_x)
                    timestamps.append(curr_frame / fps)
            
            curr_frame += 1
            
    finally:
        cap.release()
        if face_detection:
            face_detection.close()
    
    if not face_centers:
        # Fallback to center crop
        return lambda t: width // 2

    # Smooth the centers
    # Simple moving average
    window_size = 10
    if len(face_centers) < window_size:
        smoothed_centers = face_centers
    else:
        smoothed_centers = np.convolve(face_centers, np.ones(window_size)/window_size, mode='valid')
    
    # Interpolate function
    # We need to map time t to x_center
    # Since we skipped frames, we need to interpolate
    if len(face_centers) < window_size:
        valid_timestamps = timestamps
    else:
        valid_timestamps = timestamps[len(timestamps) - len(smoothed_centers):] # Adjust timestamps for convolution valid mode
    
    if not valid_timestamps:
         return lambda t: width // 2

    def get_center_x(t):
        return np.interp(t, valid_timestamps, smoothed_centers)
        
    return get_center_x

def extract_best_frame(video_path: str, start: float, end: float) -> np.ndarray:
    """
    Extracts the 'best' frame from the video segment.
    Currently picks the frame at the midpoint.
    """
    try:
        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        midpoint = (start + end) / 2
        frame_idx = int(midpoint * fps)
        
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        success, frame = cap.read()
        cap.release()
        
        if success:
            return frame
        else:
            print("Failed to extract frame at midpoint. Trying start frame...")
            cap = cv2.VideoCapture(video_path) # Re-open
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(start * fps))
            success, frame = cap.read()
            cap.release()
            
            if success:
                return frame
            
            print("Failed to extract start frame. Trying frame 0...")
            cap = cv2.VideoCapture(video_path)
            success, frame = cap.read()
            cap.release()
            
            if success:
                return frame
                
            print("Failed to extract any frame.")
            return None
    except Exception as e:
        print(f"Error extracting best frame: {e}")
        return None

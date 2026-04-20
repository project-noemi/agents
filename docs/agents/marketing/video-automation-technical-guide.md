# Video Automation Pod: Technical Guide (System Setup)

> Historical example: this guide documents a Python-based legacy implementation kept for illustration. It is not the recommended starting point for new NoéMI builds.

This guide provides the technical configuration, architecture, and environment setup for the Video Automation Pod.

---

## 🏗️ System Architecture

The pod follows a **Decoupled Multi-Agent Orchestration** pattern:

1.  **Dropbox Watcher (`dropbox_watcher.py`)**: Uses the Dropbox API to poll the `/VideoPod/Inbound` folder. It downloads matched file pairs to a local `tmp/` folder and triggers the `Manager`.
2.  **Manager Agent (`manager.py`)**: The central hub that creates the `Project Context` and chains the specialized agents together.
3.  **SEO Agent (`seo_agent.py`)**: Responsible for transcribing audio and generating curiosity-driven titles/metadata via Gemini Pro 1.5.
4.  **Thumbnail Agent (`thumb_agent.py`)**: Responsible for frame extraction (OpenCV), background removal (rembg), and design compositing (Pillow).

---

## 🛠️ Environment Configuration

To run the pod with Fetch-on-Demand, use a vault-reference env file such as [`../../../examples/video-automation-pod/.env.example`](../../../examples/video-automation-pod/.env.example).

### Vault-Reference Env File Template
```env
# Google Gemini API Key
GEMINI_API_KEY=op://noemi/gemini/api-key

# Dropbox API credentials
DROPBOX_ACCESS_TOKEN=op://noemi/dropbox/access-token
```

### 📦 Python Dependencies
The system requires Python 3.10+.
```bash
pip install -r requirements.txt
```

---

## 🔑 Dropbox App Configuration

To use the Dropbox Watcher, you must create a Dropbox App:

1.  Go to the [Dropbox Developers Console](https://www.dropbox.com/developers/apps).
2.  **Create App**: Select "Scoping Access" and "Full Dropbox" (or a specific "App Folder").
3.  **Permissions**: Ensure the following scopes are enabled:
    - `files.content.read`
    - `files.content.write`
    - `files.metadata.read`
    - `files.metadata.write`
4.  **Generate Access Token**: Click "Generate" and store the token in your SecretOps vault rather than in a local plaintext env file.

---

## 📂 Processing Pipeline (The Logic)

1.  **Polling Loop:** `dropbox_watcher.py` checks for file pairs every 60 seconds.
2.  **Download:** Once found, it downloads them to a local `tmp/` folder.
3.  **Transcribe:** The SEO Agent uses `ffmpeg` to extract audio and a transcription service (Whisper or Gemini) to get the text from the **Rough Assembly**.
4.  **Analyze:** Gemini Pro analyzes the transcript against the "Amanda Horvath Methodology" instructions.
5.  **Scan:** The Thumbnail Agent scans the pose clip using a saliency-based frame picker (OpenCV).
6.  **Strip:** The agent strips backgrounds using `rembg` (this step is GPU-intensive if available).
7.  **Composite:** Pillow layers the transparent faces over brand assets, applying titles/hooks as text layers.
8.  **Finalize:** The Manager moves the outputs back to Dropbox and cleans up the local `tmp/` folder.

---

## 🚀 Scaling and Future Upgrades

- **GPU Acceleration**: For faster `rembg` processing, ensure CUDA is installed.
- **Advanced Saliency**: Future versions can use Mediapipe for high-resolution facial expression scoring.
- **Auto-Upload**: Integration with the YouTube API to automatically draft the video for review.

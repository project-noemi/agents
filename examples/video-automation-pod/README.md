# Video Automation Pod: The Amanda Horvath Workflow

This folder contains the implementation scripts for automating your YouTube video "Packaging" (Thumbnails, Titles, SEO).

## 🗂️ Project Structure
- `manager.py`: The orchestrator script. Run this to start the pod.
- `seo_agent.py`: Intelligence agent for transcription and title generation.
- `thumb_agent.py`: Visual agent for pose extraction and compositing.
- `requirements.txt`: Python dependencies.

## 🛠️ Usage

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Run the pod:**
   ```bash
   python manager.py --project "[ProjectName]" --rough_cut [main_rough_cut.mp4] --pose_clip [pose_video.mp4]
   ```

## 🧠 What it does
1. **Transcribes** your rough assembly to understand the "Big Idea."
2. **Generates** 3 curiosity-driven titles and thumbnail hooks.
3. **Scans** your separate pose clip for the most expressive frames.
4. **Composites** 15+ thumbnail variations with your brand colors and assets.

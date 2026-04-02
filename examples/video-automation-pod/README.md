# Video Automation Pod: The Amanda Horvath Workflow

> Historical example: this Python-based pod is retained as an illustrative legacy reference. For new NoéMI builds, start with the secure secret management path and current reference architecture docs first.

This folder contains the implementation scripts for automating your YouTube video "Packaging" (Thumbnails, Titles, SEO).

## 🗂️ Project Structure
- `manager.py`: The orchestrator script. Run this to start the pod.
- `seo_agent.py`: Intelligence agent for transcription and title generation.
- `thumb_agent.py`: Visual agent for pose extraction and compositing.
- `requirements.txt`: Python dependencies.

## Usage

1. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

2. **Review the required variable names** in `.env.example` and store the real values in your vault.

3. **Run the pod** (secrets injected at runtime via vault CLI):
   ```bash
   op run --env-file=.env.example -- python manager.py --project "[ProjectName]" --rough_cut [main_rough_cut.mp4] --pose_clip [pose_video.mp4]
   ```

4. **Run the Dropbox watcher** (optional, polls for new video pairs):
   ```bash
   op run --env-file=.env.example -- python dropbox_watcher.py
   ```

## 🧠 What it does
1. **Transcribes** your rough assembly to understand the "Big Idea."
2. **Generates** 3 curiosity-driven titles and thumbnail hooks.
3. **Scans** your separate pose clip for the most expressive frames.
4. **Composites** 15+ thumbnail variations with your brand colors and assets.

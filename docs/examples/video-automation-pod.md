# Video Automation Pod (The Amanda Horvath Methodology)

This example demonstrates a multi-agent orchestration pattern designed to automate the video content lifecycle for high-authority brands. It replicates the **Amanda Horvath Methodology**, focusing on strategic "packaging" (thumbnails, titles, SEO) through a "Shooting for the Edit" and "Batch Processing" workflow.

## 🏗️ Architecture: The Marketing Pod

The system is composed of specialized micro-agents coordinated by a central Orchestrator.

### 1. The Watcher (Dropbox Agent)
**File:** `dropbox_watcher.py`  
The "Inbound" agent. It monitors a specific Dropbox folder for new video pairs, downloads them locally, and triggers the processing pipeline.

### 2. The Manager (The Orchestrator)
**File:** `manager.py`  
The Creative Director. It manages the **Project Context**, taking the raw inputs (Rough Cut + Pose Clip) and directing the specialized sub-agents.

### 3. The Strategist (SEO Agent)
**File:** `seo_agent.py`  
The "Brain." It analyzes the rough cut audio/transcript to extract the core message, target keywords, and curiosity-driven hooks.

### 4. The Visualizer (Thumbnail Agent)
**File:** `thumb_agent.py`  
The "Eyes." It uses programmatic compositing to generate high-volume thumbnail variations from a dedicated pose clip.

---

## 📖 Detailed Documentation

For more specific information, please refer to the following guides:

*   **[User Guide](../../agents/marketing/video-automation-user-guide.md):** For creators and editors. Covers folder structures, naming conventions, and the daily workflow.
*   **[Technical Guide](../../agents/marketing/video-automation-technical-guide.md):** For developers and system administrators. Covers environment setup, Dropbox API configuration, and script architecture.

---

## 📚 Methodology Principles

1.  **Shooting for the Edit:** We don't wait for a final edit to start marketing. Intelligence is extracted from the "Rough Cut."
2.  **Separate Visual Sources:** We use a dedicated clip for thumbnails (poses) to ensure high-energy, expressive assets.
3.  **Programmatic Design:** We don't "paint from scratch." We use code to composite layers, ensuring perfect brand consistency.
4.  **A/B Testing Loops:** The agent generates 15+ variations in seconds, allowing the creator to choose the winner.

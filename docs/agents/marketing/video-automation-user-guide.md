# Video Automation Pod: User Guide (Creators & Editors)

This guide is designed for **Amanda Horvath** and her editing team. It explains how to interact with the Video Automation Pod to generate thumbnails, titles, and SEO metadata automatically.

---

## 📅 The Daily Workflow

The Video Automation Pod is an "autonomous assistant" that monitors your Dropbox for new projects. You don't need to touch any code—you just need to follow the file-naming rules.

### 1. Upload your "Rough Assembly"
As soon as the video editor has a rough assembly (A-roll only, no B-roll or polish needed), they should upload it to the **Dropbox Inbound Folder**.
- **The "Brain" Source:** The agent listens to this file to understand your message and keywords.

### 2. Upload your "Pose Clip"
This is the separate video clip where you perform various expressive poses for the thumbnail.
- **The "Visual" Source:** The agent scans this file for the most expressive "faces" to use in your thumbnails.

---

## 📂 Dropbox Folder Structure

The agent monitors these specific folders:

1.  **`/VideoPod/Inbound`**: This is where you drop your new files.
2.  **`/VideoPod/Processed`**: After the agent is done, it moves your files here to keep the inbound folder clean.
3.  **`/VideoPod/Outputs`**: This is where your 15+ thumbnail variations and SEO data will appear.

---

## 🏷️ File Naming Conventions (CRITICAL)

The agent uses a "Project ID" to match your files. You **must** use the following naming pattern:

- **Rough Assembly:** `[ProjectName]_rough_assembly.mp4` (e.g., `ROI_Grok_v1_rough_assembly.mp4`)
- **Pose Clip:** `[ProjectName]_pose.mp4` (e.g., `ROI_Grok_v1_pose.mp4`)

**Note:** If the Project ID before the `_rough_assembly` and `_pose` suffix does not match exactly, the agent will not start processing.

---

## 🏁 What You Get (The Outputs)

Within minutes of uploading your files, a new folder will appear in `/VideoPod/Outputs/[ProjectName]`:

1.  **Thumbnail Variations Folder:** 15 high-res `.jpg` files. Each one mixes a different title hook with a different expressive face.
2.  **SEO_Pack.json:** A text file containing:
    - 3 Curiosity-driven Titles.
    - An optimized YouTube Description.
    - Metadata tags.
    - Timestamped chapters for your video description.

---

## ❓ Troubleshooting

- **The agent isn't picking up my files:** Check that you have both the `_rough_assembly` and `_pose` files in the `Inbound` folder and that their names match.
- **The faces look weird:** Ensure your `pose_clip` has good lighting and you are holding your poses for at least 1-2 seconds.
- **I want a different title:** You can re-run the process by moving the files from `Processed` back to `Inbound` and the agent will regenerate them.

# LEGACY/ILLUSTRATIVE — This Python example is provided for historical reference only.
# The canonical implementation path for Project NoéMI is Node.js.
# See REQUIREMENTS.md Section 8 and AGENTS.md for details.

import os
import argparse
from seo_agent import run_seo_agent
from thumb_agent import run_thumbnail_agent

def main():
    parser = argparse.ArgumentParser(description="Amanda Horvath Video Automation Pod")
    parser.add_argument("--project", required=True, help="Name of the project")
    parser.add_argument("--rough_cut", required=True, help="Path to the rough cut video (Strategy Source)")
    parser.add_argument("--pose_clip", required=True, help="Path to the thumbnail pose clip (Visual Source)")
    
    args = parser.parse_args()

    print(f"🚀 Starting Video Automation Pod for Project: {args.project}")
    
    # 1. Start SEO Agent (Strategy)
    print("🤖 Agent 1: The Strategist is analyzing the Rough Cut...")
    project_context = run_seo_agent(args.rough_cut)
    
    # 2. Start Thumbnail Agent (Visuals)
    print("📸 Agent 2: The Visualizer is scanning the Pose Clip...")
    run_thumbnail_agent(args.pose_clip, project_context)
    
    print(f"✅ Pod Execution Complete! Results for '{args.project}' are ready in /outputs")

if __name__ == "__main__":
    main()

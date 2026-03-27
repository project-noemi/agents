import os
import sys
import time
import dropbox
import subprocess

# Fetch-on-Demand: credentials are injected at runtime via vault CLI wrappers.
# Usage:  op run --env-file=.env.template -- python dropbox_watcher.py
#    or:  infisical run --env=dev -- python dropbox_watcher.py
DROPBOX_TOKEN = os.environ.get("DROPBOX_ACCESS_TOKEN")
if not DROPBOX_TOKEN:
    sys.exit("DROPBOX_ACCESS_TOKEN not set. Use 'op run' or 'infisical run' to inject secrets.")
dbx = dropbox.Dropbox(DROPBOX_TOKEN)

# Configuration
INBOUND_FOLDER = "/VideoPod/Inbound"
PROCESSED_FOLDER = "/VideoPod/Processed"
LOCAL_TMP = "./tmp"

def check_for_pairs():
    print("🔍 Scanning Dropbox for new video pairs...")
    try:
        files = dbx.files_list_folder(INBOUND_FOLDER).entries
        filenames = [f.name for f in files]
        
        # Look for matching projects
        projects = set()
        for name in filenames:
            if "_rough_assembly.mp4" in name:
                project_id = name.replace("_rough_assembly.mp4", "")
                if f"{project_id}_pose.mp4" in filenames:
                    projects.add(project_id)
        
        return list(projects)
    except Exception as e:
        print(f"❌ Error scanning Dropbox: {e}")
        return []

def download_and_process(project_id):
    print(f"🚀 Found project: {project_id}. Starting download...")
    
    rough_path = f"{INBOUND_FOLDER}/{project_id}_rough_assembly.mp4"
    pose_path = f"{INBOUND_FOLDER}/{project_id}_pose.mp4"
    
    local_rough = os.path.join(LOCAL_TMP, f"{project_id}_rough_assembly.mp4")
    local_pose = os.path.join(LOCAL_TMP, f"{project_id}_pose.mp4")
    
    os.makedirs(LOCAL_TMP, exist_ok=True)
    
    # Download
    dbx.files_download_to_file(local_rough, rough_path)
    dbx.files_download_to_file(local_pose, pose_path)
    
    # TRIGGER THE MANAGER
    print(f"⚡ Triggering Marketing Pod for {project_id}...")
    subprocess.run([
        "python", "manager.py", 
        "--project", project_id, 
        "--rough_cut", local_rough, 
        "--pose_clip", local_pose
    ])
    
    # Cleanup: Move to processed
    print(f"✅ Cleanup: Moving {project_id} to Processed folder...")
    dbx.files_move_v2(rough_path, f"{PROCESSED_FOLDER}/{project_id}_rough_assembly.mp4")
    dbx.files_move_v2(pose_path, f"{PROCESSED_FOLDER}/{project_id}_pose.mp4")
    
    # Remove local temp files
    os.remove(local_rough)
    os.remove(local_pose)

if __name__ == "__main__":
    while True:
        projects = check_for_pairs()
        for p in projects:
            download_and_process(p)
        
        print("😴 No complete pairs found. Waiting 60 seconds...")
        time.sleep(60)

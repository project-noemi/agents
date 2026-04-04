# LEGACY/ILLUSTRATIVE — This Python example is provided for historical reference only.
# The canonical implementation path for Project NoéMI is Node.js.
# See REQUIREMENTS.md Section 8 and AGENTS.md for details.

import os

def main():
    # Phase 0 Security: Agent assumes the variable exists in process memory
    # It NEVER creates a local .env file or asks the user for the password in chat.
    db_url = os.getenv("DATABASE_URL")
    api_key = os.getenv("OPENAI_API_KEY")
    
    if not db_url or not api_key:
        raise ValueError("Missing secrets. Phase 0 breach: Did you execute with `infisical run --env=dev --`?")
    
    print("✅ Secrets securely injected into process memory.")
    print("Connecting to database...")
    # Business logic here...

if __name__ == "__main__":
    main()

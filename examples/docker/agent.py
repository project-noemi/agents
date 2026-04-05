# LEGACY/ILLUSTRATIVE — This Python example is provided for historical reference only.
# The canonical implementation path for Project NoéMI is Node.js.
# See REQUIREMENTS.md Section 8 and AGENTS.md for details.

import os
from google import genai
from google.genai import types

def main():
    # 1. Verify the environment variable was injected safely by Docker
    # We accept GEMINI_API_KEY for workshop consistency and GOOGLE_API_KEY
    # for SDK-default compatibility. Both must be injected at runtime.
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    if not api_key:
        print("❌ ERROR: GEMINI_API_KEY not found.")
        print("Start Docker with vault-backed runtime injection, for example:")
        print("  op run --env-file=.env.example -- docker compose up -d --build")
        return

    print("🤖 Initializing Project NoéMI Base Agent...")

    # 2. Initialize the Gemini Client with the provided API key
    client = genai.Client(api_key=api_key)

    # 3. Description Phase: Define the Agent's rules of engagement
    sys_instruct = "You are a logical, concise AI assistant for Project NoéMI. Respond directly and clearly."
    prompt = "Acknowledge your activation and state your primary objective in exactly one sentence."

    print(f"🧠 Sending Prompt: '{prompt}'\n")

    # 4. Execute the cognitive task
    try:
        response = client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt,
            config=types.GenerateContentConfig(
                system_instruction=sys_instruct,
                temperature=0.2, # Low temperature for logical, predictable responses
            ),
        )
        print("✅ Agent Response:")
        # Print the response in green text for visual feedback
        print(f"\033[92m{response.text}\033[0m")

    except Exception as e:
        print(f"❌ Execution Failed: {e}")

if __name__ == "__main__":
    main()

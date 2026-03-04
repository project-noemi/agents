#### Overview
This file dictates how Gemini interacts with its built-in web search and web fetch capabilities.

#### 1. Verification vs. Discovery
Use web search primarily for verifying facts, gathering up-to-date documentation, or diagnosing unknown error messages. Do not use web search for general conversational knowledge that is already well-established within your training data.

#### 2. URL Processing
When fetching content from specific URLs (`web_fetch`), ensure the URLs are well-formed. If a URL returns a paywall or anti-bot challenge, do not attempt to bypass it; inform the user that the content is inaccessible.

#### 3. Citation & Summarization
Always synthesize and summarize search results in your own words rather than dumping raw excerpts. If asked for sources, clearly provide the URLs or citations corresponding to the information retrieved.
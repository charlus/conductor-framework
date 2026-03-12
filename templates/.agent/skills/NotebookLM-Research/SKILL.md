---
name: notebooklm-research
description: Conversational Research Partner using NotebookLM (Gemini 2.5 • Session RAG). Manage notebooks, conduct deep research, and maintain the library.
allowed-tools:
  - notebooklm:ask_question
  - notebooklm:add_notebook
  - notebooklm:list_notebooks
  - notebooklm:get_notebook
  - notebooklm:select_notebook
  - notebooklm:update_notebook
  - notebooklm:remove_notebook
  - notebooklm:search_notebooks
  - notebooklm:get_library_stats
  - notebooklm:list_sessions
  - notebooklm:close_session
  - notebooklm:reset_session
  - notebooklm:get_health
  - notebooklm:setup_auth
  - notebooklm:re_auth
  - notebooklm:cleanup_data
---

# NotebookLM Research Partner

This skill enables you to use NotebookLM as a conversational research partner. It leverages Gemini 2.5 and RAG (Retrieval-Augmented Generation) to answer questions based on your curated sources.

## Core Workflows

### 1. Research & Q&A

Use `ask_question` to interact with your notebooks.

- **Context Switching**: Use `select_notebook` to switch the active context.
  - *Example*: "Switching to React notebook for this task..."
- **Session Management**: Use `list_sessions` to find and resume past conversations.
  - *Best Practice*: Continue existing sessions for related questions to maintain context.

**Tool Usage:**
- `ask_question(question, [notebook_id], [session_id])`: Ask a question.
- `list_sessions()`: See active sessions.
- `close_session(session_id)`: Close a session when done.
- `reset_session(session_id)`: Clear history but keep the session.

### 2. Library Management

**Adding Notebooks (`add_notebook`)**
⚠️ **PERMISSION REQUIRED**: Only add notebooks when the user explicitly asks.
**Mandatory Workflow:**
1.  **Ask URL**: "What is the NotebookLM URL?"
2.  **Ask Content**: "What knowledge is inside?" (1–2 sentences)
3.  **Ask Topics**: "Which topics does it cover?" (3–5)
4.  **Keep it organized**: Propose metadata (Name, Description, Topics).
5.  **Confirm**: "Add it to your library now?" -> Call `add_notebook` only after "Yes".

**Updating Metadata (`update_notebook`)**
Updates topics, descriptions, or names based on user intent.
- *Pattern*: Identify change -> Propose specific update -> Confirm -> Call tool.

**Removing Notebooks (`remove_notebook`)**
⚠️ **DANGEROUS**: Requires explicit confirmation.
- *Workflow*: User requests removal -> Confirm full name -> "Remove '[name]' from library?" -> Call tool on "Yes".

**Discovery**
- `list_notebooks()`: Show all available sources.
- `search_notebooks(query)`: Find relevant notebooks by topic or content.
- `get_library_stats()`: Check library usage.

### 3. Authentication & Health

**Setup (`setup_auth`)**
Use for first-time setup or if `get_health` shows `authenticated: false`.
- Opens a browser window for the user to log in.
- **Timeout**: You have 10 minutes to complete login.

**Maintenance (`re_auth` & `cleanup_data`)**
- `re_auth`: Use if rate limited (50 queries/day free) or to switch accounts.
- `cleanup_data`: comprehensive cleanup of old data/sessions.
  - **Critical**: Close ALL Chrome instances before running cleanup.
  - **Preserve Library**: set `preserve_library=true` to keep your notebook list while cleaning cache.

**Troubleshooting Flow**:
If auth fails repeatedly:
1.  Ask user to close Chrome.
2.  `cleanup_data(confirm=true, preserve_library=true)`
3.  `re_auth` (or `setup_auth`)

## Tips for Effective Use

- **No Active Notebook?**: Check `list_notebooks` to see what's available. If nothing fits, ask the user if they have a notebook for this topic.
- **Ambiguous Context**: If the user asks a question that could apply to multiple notebooks, ask for clarification or propose a specific notebook.
- **Detailed Answers**: NotebookLM references specific sources. When relaying answers, mention that the information comes from the notebook sources.

## Reference: How to Get a Share Link
To add a notebook, the user needs to:
1.  Go to https://notebooklm.google/
2.  Open a notebook -> Click "Share" (top right).
3.  Select "Anyone with the link".
4.  Copy the link and provide it to you.

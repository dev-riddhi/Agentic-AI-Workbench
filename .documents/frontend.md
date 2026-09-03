# Sovereign On-Premise Agentic AI Workbench — Frontend

## 1. Main Goal

The frontend provides a simple interface for users to:

* Create AI agents
* Configure AI agents
* Select a local/open-weight AI model
* Give agents tools
* Upload knowledge/documents
* Run and chat with agents
* Manage existing agents

The frontend should focus on **simplicity and usability**, not on building a large number of advanced features.

---

## 2. Frontend Architecture

```text
                    FRONTEND
                       │
                       ▼
              ┌─────────────────┐
              │   Web Interface │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Agent UI      Model UI     Settings
          │
          ▼
    Agent Workspace
          │
    ┌─────┼─────────────┐
    ▼     ▼             ▼
 Configure Tools      Knowledge
 Agent                /Documents
          │
          ▼
       Chat / Run
          │
          ▼
      Backend API
```

---

## 3. Main Screens

### 3.1 Agent List

The main screen displays all available agents.

Users should be able to:

* View agents
* Open an agent
* Edit an agent
* Delete an agent
* Create a new agent

Example:

```text
AI Workbench

My Agents

┌─────────────────────────────────┐
│ Maintenance Agent               │
│ Machine maintenance assistant   │
│ Model: Qwen                     │
│                                 │
│ [Open] [Edit] [Delete]          │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Document Assistant              │
│ Company document assistant      │
│ Model: Llama                    │
│                                 │
│ [Open] [Edit] [Delete]          │
└─────────────────────────────────┘

             [+ Create Agent]
```

---

### 3.2 Create Agent

This is one of the most important screens.

The user should be able to configure:

* Agent name
* Description
* System instructions
* AI model
* Tools
* Knowledge/documents

Example:

```text
Create Agent

Name
[ Maintenance Agent ]

Description
[ Machine maintenance assistant ]

Instructions
[ You are an industrial maintenance assistant... ]

Model
[ Qwen ▼ ]

Tools

☑ Document Search
☑ File Reader
☐ Python
☐ Internal API

Knowledge

[ + Upload Documents ]

              [Create Agent]
```

---

### 3.3 Agent Workspace

The workspace allows the user to interact with an agent.

```text
┌─────────────────────────────────────────────┐
│ Maintenance Agent                           │
│ Model: Qwen                                 │
├─────────────────────────────────────────────┤
│                                             │
│ User                                        │
│ Analyze this machine report.                │
│                                             │
│ Agent                                       │
│ I found three potential issues...           │
│                                             │
│ ✓ Document Search                           │
│ ✓ Maintenance Manual                        │
│                                             │
├─────────────────────────────────────────────┤
│ Ask the agent...                    [Send]  │
└─────────────────────────────────────────────┘
```

The workspace should also show the agent's current activity.

```text
Agent is working...

✓ Reading document
✓ Searching knowledge
● Analyzing data
○ Generating response
```

This helps demonstrate that the system is actually **agentic** rather than simply a chatbot.

---

### 3.4 Agent Configuration

Users should be able to modify an existing agent.

```text
Agent Settings

General
    Name
    Description
    Instructions

Model
    Local Model

Tools
    Available Tools

Knowledge
    Uploaded Documents

              [Save Changes]
```

---

### 3.5 Model Screen

Display the models available in the local environment.

```text
Local Models

┌─────────────────────────────────┐
│ Qwen                            │
│ Multimodal Model                │
│ Status: ● Available             │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Llama                           │
│ Text Model                      │
│ Status: ● Available             │
└─────────────────────────────────┘
```

The frontend does not run the model itself. It requests model information from the backend.

---

## 4. Frontend → Backend Communication

The frontend communicates with the backend through APIs.

```text
Frontend
    │
    │ HTTP / HTTPs
    ▼
FastAPI Backend
```

Example API operations:

```text
GET     /agents
POST    /agents
GET     /agents/{id}
PUT     /agents/{id}
DELETE  /agents/{id}

GET     /models

POST    /documents
GET     /agents/{id}/documents

POST    /agents/{id}/run
```

For agent execution, WebSocket or Server-Sent Events can later be used to stream:

```text
Thinking
Tool execution
Tool result
Final response
```

---

## 5. Recommended Frontend Technology

For the MVP:

```text
Frontend
│
├── React
├── TypeScript
├── Vite / Next.js
└── Tailwind CSS
```

The frontend should remain independent from the AI model.

Its responsibility is primarily:

```text
User Interface
      ↓
Agent Configuration
      ↓
API Requests
      ↓
Display Results
```

---

## 6. MVP Priority

Focus on these features first:

1. Agent List
2. Create Agent
3. Configure Agent
4. Select Local Model
5. Upload Documents
6. Agent Chat / Execution
7. Agent Edit/Delete

Avoid implementing advanced dashboards, marketplaces, complex workflow builders, and large numbers of integrations until the core workflow works.

---

# Core Frontend Workflow

```text
Create Agent
      ↓
Configure Agent
      ↓
Select Local Model
      ↓
Add Tools
      ↓
Upload Knowledge
      ↓
Save Agent
      ↓
Run Agent
      ↓
View Execution
      ↓
Receive Result
```

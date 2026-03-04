# Open Brain: Companion Prompts

Your Open Brain is built. Now make it work for you. These five prompts cover the full lifecycle: migrate your existing AI memories into the system, bring over your existing second brain, discover how it fits your specific workflow, build the daily capture habit, and run a weekly review that surfaces patterns you'd never catch on your own.

**What's included:**

- **Prompt 1: Memory Migration** — Extract everything your AI already knows about you and save it to your Open Brain
- **Prompt 2: Second Brain Migration** — Move existing notes from Notion, Obsidian, or any other system into your Open Brain
- **Prompt 3: Open Brain Spark** — Personalized use case discovery based on your actual work and habits
- **Prompt 4: Quick Capture Templates** — Five capture patterns optimized for clean metadata extraction
- **Prompt 5: The Weekly Review** — End-of-week synthesis that surfaces themes, forgotten action items, and emerging patterns

**Requirements:** All prompts work with any MCP-connected AI (Claude, ChatGPT, Gemini, Grok). Prompts 1, 2, and 5 require your Open Brain MCP server to be connected.

---

## Prompt 1: Memory Migration

**Job:** Extracts everything your AI already knows about you and saves it to your Open Brain, so every other AI you connect starts with that foundation instead of zero.

**When to use:** Right after you finish the Open Brain setup. Run this once per AI platform that has memory about you (Claude, ChatGPT, etc.).

**What you'll get:** Your accumulated platform memories, organized into capture-ready chunks and saved directly to your Open Brain database.

### Paste this prompt into your AI:

```
You are a memory migration assistant. Your job is to extract everything you know about me from your memory and conversation history, organize it into clean knowledge chunks, and save each one to my Open Brain using the capture_thought MCP tool.

CONTEXT GATHERING:
1. First, confirm the Open Brain MCP server is connected by checking for the capture_thought tool. If it's not available, stop and tell me: "I can't find the capture_thought tool. Make sure your Open Brain MCP server is connected."

2. Check your memory and conversation history for EVERYTHING you know about me. Pull up every stored memory, preference, fact, project detail, person reference, decision, and context you have accumulated.

3. Organize what you find into these categories:
   - People (names, roles, relationships, key details)
   - Projects (active work, goals, status, decisions made)
   - Preferences (communication style, tools, workflows, habits)
   - Decisions (choices made, reasoning, constraints that drove them)
   - Recurring topics (themes that come up repeatedly)
   - Professional context (role, company, industry, team structure)
   - Personal context (interests, location, life details shared naturally)

4. Present the organized results to me: "Here's everything I've accumulated about you, organized by category. I found [X] items across [Y] categories. Let me walk you through them before we save anything."

5. Show each category with its items listed clearly.

6. Ask: "Want me to save all of these to your Open Brain? I can also skip any items you'd rather not store, or you can edit anything that's outdated before I save it."

7. Wait for my response.

EXECUTION:
For each approved item, use the capture_thought tool to save it to the Open Brain. Format each save as a clear, standalone statement that will make sense when retrieved later by a different AI.

Good format: "Sarah Chen is my direct report. She joined the team in March, focuses on backend architecture, and is considering a move to the ML team."

Bad format: "Sarah - DR - backend" (too compressed, loses context for future retrieval)

Save items one at a time or in small batches. After each batch, confirm: "Saved [X] items in [category]. Moving to [next category]."

After all categories are saved, give a final summary: "Migration complete. Saved [total] items across [categories]. Your Open Brain now has a foundation that any connected AI can access."

GUARDRAILS:
- Only extract memories and context that actually exist. Do not invent or assume details.
- If a memory seems outdated, flag it: "This might be outdated — want me to save it as-is, update it, or skip it?"
- Save each item as a self-contained statement. Another AI reading this with zero prior context should understand what it means.
- If the capture_thought tool isn't working or returns errors, stop and tell me what's happening so I can troubleshoot.
```

---

## Prompt 2: Second Brain Migration

**Job:** Migrates your existing second brain — Notion databases, Obsidian vaults, Apple Notes, text files, n8n captures, or anything else — into your Open Brain so you don't lose what you've already built.

**When to use:** After setup, if you have an existing note-taking or knowledge management system. Works with any format you can export or paste.

**What you'll get:** Your existing notes and captures transferred into the Open Brain, fully embedded and searchable by meaning alongside everything else.

### Paste this prompt into your AI:

```
You are a second brain migration assistant. Your job is to help me move my existing notes, captures, and knowledge from another system into my Open Brain. You handle the messy reality of different export formats — Notion pages, Obsidian markdown, CSV exports, n8n logs, plain text dumps, whatever I have — and transform each piece into a clean, standalone thought that the Open Brain can embed and search effectively.

CONTEXT GATHERING:
1. First, confirm the Open Brain MCP server is connected by checking for the capture_thought tool. If it's not available, stop and tell me: "I can't find the capture_thought tool. Make sure your Open Brain MCP server is connected."

2. Ask: "What system are you migrating from? Tell me what you've been using — Notion, Obsidian, Apple Notes, a Telegram bot, n8n workflows, text files, or something else. If it's a combination, list them all."

3. Wait for my response.

4. Based on my system, give me specific export instructions:

   Notion: "Go to Settings → Export all workspace content → choose Markdown & CSV. Unzip the downloaded file. You can paste the contents of individual pages here, or if you have a lot, paste them in batches. Focus on the pages that have your actual thinking — skip template pages, empty databases, and structural pages."

   Obsidian: "Open your vault folder in Finder/Explorer. Your notes are markdown files. You can paste them here directly. Start with your most-used notes — daily notes, MOCs (Maps of Content), or whatever holds your real thinking."

   Apple Notes: "Apple Notes doesn't have a great export. The fastest path: open each note you want to migrate, Select All, Copy, and paste it here. Start with the notes you actually reference — skip shopping lists and quick reminders unless you want those in your brain too."

   n8n / Zapier / automation captures: "If your automation stored data in a spreadsheet, database, or Notion, export that. CSV is ideal — paste the contents here. If it's in a Telegram chat or similar, copy the messages you want to keep."

   Text files / CSV / other: "Paste the contents here. If it's a CSV, I'll parse the rows. If it's raw text, I'll break it into logical chunks."

   Multiple systems: "Let's do one system at a time. Which one has the most content you care about? We'll start there."

5. Ask: "Before we start: is there anything you want to skip? Categories, date ranges, or types of notes you don't need in the Open Brain?"

6. Wait for my response.

PROCESSING:
When I paste content, process it in these steps:

1. Parse the format. Identify what you're looking at — Notion markdown (has YAML frontmatter, database properties), Obsidian markdown (has [[wikilinks]], tags), CSV rows, plain text, etc. Don't ask me to reformat anything. Handle it as-is.

2. Break into logical chunks. Each chunk should be one self-contained thought, decision, note, or piece of context. Rules:
   - A short note (1-3 sentences) = one chunk as-is
   - A long note with multiple distinct ideas = split into separate chunks
   - A database row = one chunk per row, combining the fields into a readable statement
   - A meeting note = one chunk per key point or decision, not the whole transcript
   - A daily note with multiple entries = one chunk per entry

3. Transform each chunk into a standalone statement. The Open Brain stores thoughts, not document fragments. Each chunk should:
   - Make sense to an AI reading it with zero context about the original system
   - Include relevant context that was in the original structure (dates, tags, linked pages) woven into the text
   - Drop formatting artifacts (Notion property syntax, Obsidian wikilink brackets, etc.)
   - Preserve the actual meaning and detail

   Example transformation:
   - Original Notion database row: "| Meeting with Design | 2025-01-15 | #product #redesign | Action: send API spec by Friday |"
   - Transformed: "Meeting with Design team on January 15, 2025 about the product redesign. Action item: send API spec by Friday."

   Example transformation:
   - Original Obsidian note: "# Sarah catch-up\n[[Sarah Chen]] mentioned she's burned out from the [[Platform Migration]]. Wants to move to ML team. Talk to [[Mike]] about opening.\n#people #career"
   - Transformed: "Sarah Chen mentioned she's burned out from the Platform Migration project. She wants to move to the ML team. I should talk to Mike about whether there's an opening."

4. Present a preview batch. Show me the first 5-10 transformed chunks: "Here's how I'd save these. Check that the meaning is right and nothing important got lost. Once you approve, I'll save these and keep going."

5. Wait for approval or corrections.

EXECUTION:
For each approved batch, use the capture_thought tool to save each chunk individually to the Open Brain.

After each batch:
- Confirm: "Saved [X] thoughts. [Y] remaining in this paste."
- If there's more content to process, continue automatically.
- If waiting for more content from me, ask: "Ready for the next batch? Paste more content whenever you're ready."

Pacing:
- Save 5-10 thoughts at a time, confirming between batches.
- If I say "just save them all" or similar, you can increase batch size — but still confirm every 20-25 saves so I know progress is happening.

After all content from one system is migrated:
- Give a summary: "Migration from [system] complete. Saved [total] thoughts covering [top topics]. These are now searchable by meaning from any connected AI."
- Ask: "Any other systems to migrate, or are we done?"

GUARDRAILS:
- Never invent content. If a note is ambiguous, save what's clearly there and flag what's unclear.
- Preserve dates when present. They matter for retrieval ("what was I thinking about in January?").
- Preserve people's names. They're high-value metadata for the Open Brain's extraction pipeline.
- If I paste a huge amount of content (50+ notes), warn me about API costs.
- Don't save empty, structural, or template content. If a Notion page is just headers with no content, skip it.
- If capture_thought returns errors, stop and report. Don't silently skip thoughts.
- Make clear this is a copy, not a move: "Your [Notion/Obsidian/etc.] data stays where it is. We're copying the content into your Open Brain so it becomes searchable by meaning from any AI."
```

---

## Prompt 3: Open Brain Spark

**Job:** Interviews you about your actual work, tools, habits, and pain points, then generates a personalized list of Open Brain use cases you wouldn't have thought of on your own.

**When to use:** After setup, when you're staring at the CLI wondering "what do I capture?" Also useful to re-run every few months as your workflow evolves.

**What you'll get:** A personalized "Your First 20 Captures" list organized by category, plus ongoing use patterns tailored to your specific work.

### Paste this prompt into your AI:

```
You are a workflow analyst who helps people discover how a personal knowledge system fits into their actual life. You don't pitch features. You listen to how someone works, identify where context gets lost, and show them exactly what to capture and why. Be direct, practical, and specific to their situation.

CONTEXT GATHERING:
1. Before asking anything, check your memory and conversation history for context about my role, tools, workflow, team, and habits. If you find relevant context, confirm it: "Based on what I know about you, you work as [role], use [tools], and your team includes [people]. Is that still accurate?" Then only ask about what's missing below.

2. Ask: "Walk me through a typical workday. What tools do you open, what kind of work fills your time, and where do things get messy or repetitive?"
3. Wait for my response.

4. Ask: "When you start a new conversation with an AI, what do you find yourself re-explaining most often? The stuff you wish it just knew already."
5. Wait for my response.

6. Ask: "Think about the last month. What's something you forgot — a decision, a detail from a meeting, something someone told you — that cost you time or quality when you needed it later?"
7. Wait for my response.

8. Ask: "Who are the key people in your work life right now? Direct reports, collaborators, clients, stakeholders — whoever you interact with regularly where remembering context matters."
9. Wait for my response.

10. Once you have my workflow, re-explanation patterns, memory gaps, and key people, move to analysis.

ANALYSIS:
Using everything gathered, generate personalized Open Brain use cases across these five patterns:

Pattern 1 — "Save This" (preserving AI-generated insights)
Identify moments in my described workflow where AI produces something worth keeping. Examples: a framework that worked, a reframe of a problem, a prompt approach that clicked, analysis I'd want to reference later.

Pattern 2 — "Before I Forget" (capturing perishable context)
Identify moments where information is fresh but will decay: post-meeting decisions, phone call details, ideas triggered by reading something, gut reactions to proposals.

Pattern 3 — "Cross-Pollinate" (searching across tools)
Identify moments where I'm in one AI tool but need context from another part of my life. Map specific scenarios from my workflow where cross-tool memory would change the outcome.

Pattern 4 — "Build the Thread" (accumulating insight over time)
Identify topics or projects where daily captures would compound into something more valuable than any single note. Strategic thinking, project evolution, relationship context.

Pattern 5 — "People Context" (remembering what matters about people)
Based on my key people list, identify what kinds of details would be valuable to capture and recall: preferences, concerns, career goals, communication style, recent life events, project ownership.

For each pattern, generate 4-5 use cases written as specific scenarios from MY workflow, not generic examples.

OUTPUT FORMAT:

## Your Open Brain Use Cases

### Save This (Preserving What AI Helps You Create)
[4-5 specific scenarios from my workflow, each with an example capture sentence I could type]

### Before I Forget (Capturing While It's Fresh)
[4-5 specific scenarios, each with example capture]

### Cross-Pollinate (Searching Across Your Tools)
[4-5 specific scenarios showing what I'd search for and when]

### Build the Thread (Compounding Over Time)
[3-4 topics or projects from my workflow where ongoing captures would compound]

### People Context (Remembering What Matters)
[3-4 specific examples based on my key people, with example captures]

## Your Daily Rhythm
[Suggest 3-4 natural capture moments in my described workday]

## Your First 5 Captures
[Give me 5 specific things to capture RIGHT NOW based on our conversation — things I already know but haven't stored anywhere accessible]

GUARDRAILS:
- Every use case must be specific to my described workflow. No generic examples.
- Example capture sentences should be realistic — the kind of thing a person would actually type quickly, not polished prose.
- If my workflow doesn't naturally fit a pattern, skip that pattern instead of forcing it.
- The "First 5 Captures" must be things I could do immediately after this conversation.
- Do not invent details about my work. If you need more information about a specific area, ask one follow-up question.
```

---

## Prompt 4: Quick Capture Templates

**Job:** Five copy-paste sentence starters optimized for clean metadata extraction. Each one is designed to trigger the right classification in your Open Brain's processing pipeline.

**When to use:** Keep these handy as a reference. After a week of capturing, you won't need them — you'll develop your own natural patterns. But they're useful for building the habit early.

**What you'll get:** Five starter patterns with explanations of why each one works.

> "Why does formatting matter? Your Open Brain uses an LLM to extract metadata from each capture — people, topics, action items, type. These templates are structured to give that LLM clear signals, which means better tagging, better search, better retrieval."

**These are not prompts to paste into AI. These are templates for what you type when you capture thoughts** (via the CLI `brain add` command or directly to any MCP-connected AI using "save this" or "remember this").

### 1. Decision Capture

```
Decision: [what was decided]. Context: [why]. Owner: [who].
```

**Example:**
```
Decision: Moving the launch to March 15. Context: QA found three blockers in the payment flow. Owner: Rachel.
```

**Why it works:** "Decision" triggers the `task` type. Naming an owner triggers people extraction. The context gives the embedding meaningful content to match against later.

---

### 2. Person Note

```
[Name] — [what happened or what you learned about them].
```

**Example:**
```
Marcus — mentioned he's overwhelmed since the reorg. Wants to move to the platform team. His wife just had a baby.
```

**Why it works:** Leading with a name triggers `person_note` classification and people extraction. Everything after the dash becomes searchable context about that person.

---

### 3. Insight Capture

```
Insight: [the thing you realized]. Triggered by: [what made you think of it].
```

**Example:**
```
Insight: Our onboarding flow assumes users already understand permissions. Triggered by: watching a new hire struggle for 20 minutes with role setup.
```

**Why it works:** "Insight" triggers `idea` type. Including the trigger gives the embedding richer semantic content and helps you remember the original context months later.

---

### 4. Meeting Debrief

```
Meeting with [who] about [topic]. Key points: [the important stuff]. Action items: [what happens next].
```

**Example:**
```
Meeting with design team about the dashboard redesign. Key points: they want to cut three panels, keep the revenue chart, add a trend line. Action items: I send them the API spec by Thursday, they send revised mocks by Monday.
```

**Why it works:** Hits multiple extraction targets at once — people, topics, action items, dates. Dense captures like this are the highest-value entries in your brain.

---

### 5. The AI Save

```
Saving from [AI tool]: [the key takeaway or output worth keeping].
```

**Example:**
```
Saving from Claude: Framework for evaluating vendor proposals — score on integration effort (40%), maintenance burden (30%), and switching cost (30%). Weight integration highest because that's where every past vendor has surprised us.
```

**Why it works:** "Saving from [tool]" creates a natural `reference` classification. The content itself becomes searchable across every AI you use. This is how you stop losing good AI output to chat history graveyards.

---

## Prompt 5: The Weekly Review

**Job:** End-of-week synthesis across everything you captured. Surfaces themes, forgotten action items, emerging patterns, and connections you missed.

**When to use:** Friday afternoon or Sunday evening. Takes 5 minutes. Becomes more valuable every week as your brain grows.

**What you'll get:** A structured review of your week's captures with pattern analysis, overdue action items, and suggested focus areas.

### Paste this prompt into your AI:

```
You are a personal knowledge analyst who reviews a week's worth of captured thoughts and surfaces what matters. You look for patterns I wouldn't notice in the daily flow, flag things that are falling through the cracks, and connect dots across different areas of my life and work. Be direct and specific. No filler observations.

CONTEXT GATHERING:
1. Before asking anything, check your memory and conversation history for context about my role, current priorities, and active projects. If you find relevant context, note it for weighting the analysis.

2. Use the Open Brain MCP tools to retrieve all thoughts captured in the last 7 days. Pull them with the list_thoughts tool filtered to the last 7 days, and also run a search for any action items.

3. If fewer than 3 thoughts are found, tell me: "Your brain only has [X] captures from this week. The weekly review gets more useful with more data — even quick one-line captures add up. Want to do a quick brain dump right now before I run the review?"

4. If the retrieval works, ask: "I found [X] captures from this week. Before I analyze them, is there anything specific you're focused on right now that I should weight more heavily?"
5. Wait for my response (proceed if I say nothing specific).

ANALYSIS:
Using the retrieved thoughts:

1. Cluster by topic — group related captures and identify the 3-5 themes that dominated the week
2. Scan for unresolved action items — anything captured as a task or action item that doesn't have a corresponding completion note
3. People analysis — who showed up most in captures? Any relationship context worth noting?
4. Pattern detection — compare against previous weeks if available. What topics are growing? What's new? What dropped off?
5. Connection mapping — find non-obvious links between captures from different days or different contexts
6. Gap analysis — based on my role and priorities, what's conspicuously absent from this week's captures?

OUTPUT FORMAT:

## Week at a Glance
[X] thoughts captured | Top themes: [theme 1], [theme 2], [theme 3]

## This Week's Themes
For each theme (3-5):
**[Theme name]** ([X] captures)
[2-3 sentence synthesis of what I captured about this topic this week. Not a summary of each capture — a synthesis of the overall picture that emerges.]

## Open Loops
[List any action items, decisions pending, or follow-ups that appear unresolved. For each one, note when it was captured and what the original context was.]

## Connections You Might Have Missed
[2-3 non-obvious links between captures from different days or contexts. "On Tuesday you noted X, and on Thursday you captured Y — these might be related because..."]

## Gaps
[1-2 observations about what's absent. Based on my role and priorities, what topics or areas had zero captures this week that might deserve attention?]

## Suggested Focus for Next Week
[Based on themes, open loops, and gaps — 2-3 specific things to pay attention to or capture more deliberately next week.]

GUARDRAILS:
- Only analyze thoughts that actually exist in the brain. Do not invent or assume captures.
- Connections must be genuine, not forced. If there are no non-obvious links, say so rather than fabricating them.
- Gap analysis should be useful, not guilt-inducing. Frame it as opportunity, not failure.
- If I have very few captures, keep the analysis proportional. Don't over-analyze three notes.
- Keep the entire review scannable in under 2 minutes. This is a ritual, not a report.
```

---

## Why These Prompts Exist

Your Open Brain is infrastructure. These prompts are the habits that make it compound.

- **Memory Migration** gets you off the ground with context you've already built.
- **Second Brain Migration** brings over everything you've captured in other systems so you don't start from zero.
- **Spark** shows you where your brain fits into YOUR life, not someone else's.
- **Templates** build the daily capture habit.
- **Weekly Review** closes the loop.

Use them in order the first week, then keep the review as your Friday ritual.

---

**Credits:** Companion prompts adapted from Nate B. Jones' "[Your Second Brain Is Closed. Your AI Can't Use It. Here's the Fix.](https://promptkit.natebjones.com/20260224_uq1_guide_main)" guide and [companion prompts pack](https://promptkit.natebjones.com/20260224_uq1_promptkit_1).

**Self-Hosted Implementation:** This is the fully self-hosted version using PostgreSQL + Node.js + Ollama instead of Supabase + Slack + OpenRouter. See [README.md](README.md) for architecture details and [INSTALL.md](INSTALL.md) for setup instructions.

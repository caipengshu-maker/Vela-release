# Effective Harnesses for Long-Running Agents (Anthropic, 2026)

Source: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents

## Core Problem

As AI agents become more capable, developers are increasingly asking them to take on complex tasks requiring work that spans hours, or even days. However, getting agents to make consistent progress across multiple context windows remains an open problem.

The core challenge of long-running agents is that they must work in discrete sessions, and each new session begins with no memory of what came before. Because context windows are limited, and because most complex projects cannot be completed within a single window, agents need a way to bridge the gap between coding sessions.

## Two-Fold Solution

### 1. Initializer Agent
The very first agent session uses a specialized prompt that asks the model to set up the initial environment:
- An init.sh script
- A claude-progress.txt file that keeps a log of what agents have done
- An initial git commit that shows what files were added

### 2. Coding Agent
Every subsequent session asks the model to make incremental progress, then leave structured updates.

Key insight: finding a way for agents to quickly understand the state of work when starting with a fresh context window, accomplished with the progress file alongside git history.

## Environment Management

### Feature List
To address the problem of the agent one-shotting an app or prematurely considering the project complete:
- Write a comprehensive file of feature requirements expanding on the user's initial prompt
- Features initially marked as "failing"
- Use JSON format (model is less likely to inappropriately change JSON vs Markdown)
- Strongly-worded instructions: "It is unacceptable to remove or edit tests"

### Incremental Progress
- Work on only one feature at a time
- Commit progress to git with descriptive commit messages
- Write summaries of progress in a progress file
- Leave environment in a clean state (appropriate for merging to main branch)

### Testing
Major failure mode: Claude marks features as complete without proper testing.
- Explicitly prompt to use browser automation tools
- Test as a human user would (end-to-end)
- Providing testing tools dramatically improved performance

## Getting Up to Speed (Each Session)
1. Run pwd to see the directory
2. Read git logs and progress files
3. Read features list, choose highest-priority feature not yet done
4. Run init.sh to start development server
5. Run basic end-to-end test before implementing new feature
6. If app is broken, fix bugs first before new features

## Agent Failure Modes and Solutions

| Problem | Initializer Agent Behavior | Coding Agent Behavior |
|---|---|---|
| Declares victory too early | Set up feature list file (structured JSON) | Read feature list, choose single feature |
| Leaves environment with bugs | Initial git repo + progress notes | Read progress + git logs, run basic test, end with commit + progress update |
| Marks features done prematurely | Set up feature list file | Self-verify all features, only mark "passing" after careful testing |
| Spends time figuring out how to run app | Write init.sh script | Start by reading init.sh |

## Future Work
- Open question: single general-purpose agent vs multi-agent architecture
- Specialized agents (testing, QA, code cleanup) could do better at sub-tasks
- Generalizing findings beyond web app development to scientific research, financial modeling, etc.

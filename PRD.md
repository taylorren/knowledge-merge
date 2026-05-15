# Knowledge Merges — One-Page PRD

## Problem
People struggle to see meaningful connections between unrelated topics, and most tools do not guide them through a clear, understandable path from “different” to “connected.”  
Knowledge Merges should let users start from two topics, explore both branches step-by-step, and confidently identify where they converge.

## Users
- Curious learners exploring cross-domain ideas
- Educators/facilitators teaching connected thinking
- Creative thinkers/researchers seeking novel conceptual links

## User Stories
1. As a user, I want to enter two starting topics so I can begin a dual-branch exploration.
2. As a user, I want concise summaries for each step so I can understand unfamiliar topics quickly.
3. As a user, I want suggested next keywords so I can continue without getting stuck.
4. As a user, I want to add my own keyword at any step so I can steer the exploration.
5. As a user, I want to mark a merge concept when branches connect so I can complete a session.
6. As a user, I want completed merges archived as roadmap cards so I can review and reuse them later.
7. As a user, I want my active session restored when I return so I don’t lose progress.
8. As a user, I want clear status and error feedback so I always know what to do next.

## Requirements
### Functional Requirements
- Support exactly two concurrent knowledge branches per session.
- Generate concise, plain-language summary content for each selected keyword.
- Provide up to three relevant next-keyword suggestions per step.
- Allow user-entered custom keywords at any branch step.
- Allow user-declared merge concept to complete and archive a session.
- Archive merge card with: merged concept, left path, right path, and narrative.
- Persist one active session and restore it on app start.
- Show recent archived merge cards for review.

### Non-Functional Requirements
- Clarity: output must be understandable to non-experts.
- Responsiveness: visible feedback for loading, success, and failure states.
- Reliability: failures should be recoverable without blocking user progress.
- Consistency: branch interactions and terminology must behave uniformly.
- Discoverability: first-time users should complete one merge without external help.

## Success Metrics
- Session completion rate: % of started sessions that reach a user-declared merge.
- Time to first merge: median time from topic entry to first archived merge.
- Archive reuse: % of users who view archived cards after creating one.
- Flow reliability: % of generation attempts that end in usable step output.
- User clarity score: user-reported ease of understanding summaries and merge narratives.

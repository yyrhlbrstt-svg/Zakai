---
name: goal-skill
description: >-
  Completes a single user-defined goal end-to-end without pausing for confirmation.
  Use when the user defines a goal, writes /goal, asks to continue until the task
  is done, or requests uninterrupted work until the deliverable is finished.
---

# Goal Skill

## When active

Treat the user's **latest request** as **one goal** that must be completed in full.

Triggers (any of these):

- User defines an explicit goal
- User writes `/goal`
- User asks to continue / keep going until the task is finished

## Operating rules

1. **Work continuously.** After every step, immediately check progress and proceed to the next step. Do not stop to ask the user what to do next.
2. **No clarifying questions** unless the request is genuinely impossible to interpret. Infer the most reasonable reading and continue.
3. **No partial stop.** Do not end with unfinished work. Do not write “what's next?”, “let me know if you want more”, or similar handoff prompts.
4. **Quiet completion check.** After every meaningful action, silently ask: is the goal fully achieved? If anything is missing, broken, or incomplete — keep working.
5. **Stop only when objectively done.** Present the final result only when the goal is complete in an objective sense:
   - required files exist and work
   - all requested features are present
   - errors are fixed
   - the deliverable has been verified (tests, build, or equivalent checks appropriate to the goal)
6. **One continuous run for complex goals.** If the goal spans multiple files or subsystems, produce everything in a single uninterrupted sequence.
7. **Prefer decisive action over hesitation.** When uncertain, choose the most useful and complete interpretation — and execute it to the end.

## Loop

```
while goal not objectively complete:
  1. Identify the highest-leverage next step toward the goal
  2. Do it
  3. Verify (run checks / inspect artifacts)
  4. If gaps remain → continue
  5. If complete → stop and report the final result only
```

## Final response

When (and only when) the goal is complete: give a short, direct summary of what was delivered and how it was verified. No “next steps?” offers.

---
name: docs
description: Documentation structure and expectations for the ProductivityProxy docs folder.
---

# Documentation Rules

Use these docs as the project source of truth unless the code clearly contradicts them.

## Structure

```text
docs/
├── architecture/
│   ├── 0_conceptual/    # goals, scope, actors, capabilities
│   ├── 1_logical/       # black-box services and relationships
│   ├── 2_component/     # technical internals of each component
│   ├── 3_deployment/    # how the app runs locally and later ships
│   └── 4_data_layer/    # schemas, persisted data, contracts
├── assumptions/         # testable assumptions and risks
├── decisions/           # human-written ADRs only
└── unofficial/          # scratch notes, not source of truth
```

## Rules

- Keep each document at one abstraction level.
- Do not create or edit files in `docs/decisions/`; those are user-owned.
- Mention limitations explicitly. This project handles network traffic, so vague optimism is dangerous.
- Prefer simple, current-state documentation over speculative plans.
- If the code and docs disagree, update the docs or flag the mismatch.

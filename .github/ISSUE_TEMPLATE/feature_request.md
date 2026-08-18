---
name: Feature request
about: Suggest a new capability or improvement
title: '[feature] '
labels: enhancement
---

**The user need**
What problem does this solve? Whose workflow does it improve, and how is it currently painful?

**Proposed behaviour**
What should the user see / do / get?

**Alternatives considered**
Other ways to solve the same need. Why are they worse?

**Scope check**
- Does this work without a backend? (No server runtime is available; see `CONTRIBUTING.md` §6.)
- Does this stay ruleset-agnostic? (No D&D-isms in `src/utils/*`; see `CONTRIBUTING.md` §8.)
- Does it fit in Matrix state events (≤ 64 kB per event, sized for room scale)?

**Additional context**
Mockups, links, related issues.

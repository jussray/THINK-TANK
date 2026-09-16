# AI Crawler Contract v1

Think Tank treats automated access as a governed public discovery surface.

- Allow reputable search/discovery and user-directed retrieval on intentionally public explanation/result surfaces.
- Deny model-training and bulk dataset collection by default.
- Never expose private idea records, unpublished founder inputs, internal evidence, credentials, or governance-only material merely to make the site crawlable.
- Request canonical source attribution when supported.
- Crawler access is read-only and never grants publication, deployment, mutation, credential, or founder authority.

Default bot split: `OAI-SearchBot`, `ChatGPT-User`, `Claude-SearchBot`, `Claude-User`, and `Googlebot` may be allowed on verified public surfaces. `GPTBot`, `ClaudeBot`, and `Google-Extended` are denied by default.

This source contract does not claim runtime enforcement until the actual deployed public origin serves and verifies the corresponding policy. `robots.txt` is not a security boundary.

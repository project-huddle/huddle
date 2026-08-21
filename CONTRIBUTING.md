Contributing to Huddle

Thanks for your interest in contributing to Huddle.

Huddle is an open-source communication platform, and contributions from the community are welcome — whether they involve code, documentation, testing, design, accessibility, bug reports, or ideas.

Getting Started

Before making a significant contribution:

1. Check the existing issues and pull requests to see whether the problem or feature is already being discussed.
2. For substantial features or architectural changes, open an issue or discussion before starting implementation.
3. Keep contributions focused. Smaller, well-scoped pull requests are generally easier to review and merge.

Small bug fixes, documentation improvements, tests, and similar changes usually do not require prior discussion.

Development Setup

Huddle is organized as a monorepo containing the client, server, and supporting infrastructure.

The main technologies currently include:

* TypeScript
* React
* Bun
* Elysia
* PostgreSQL
* Prisma
* WebSocket
* WebRTC
* Docker

Refer to the repository README and project documentation for the current development setup and commands.

Architecture

The server follows a modular architecture with responsibilities separated between layers such as:

* core — domain concepts and rules.
* app — application services and use cases.
* infra — database, email, and external infrastructure.
* interfaces — HTTP, WebSocket, and other external interfaces.

When contributing to the backend, avoid introducing framework-specific dependencies into the domain or application layers unless there is a strong reason to do so.

Elysia and other transport-specific concerns should generally remain within the interface/infrastructure boundaries.

The project is currently evolving, so architectural conventions may change. When in doubt, follow the patterns used by recently updated parts of the codebase or discuss the change before implementing it.

Code Guidelines

When contributing code:

* Follow the existing TypeScript conventions.
* Prefer clear and explicit code over unnecessary abstractions.
* Keep modules focused on a well-defined responsibility.
* Avoid introducing new dependencies unless they provide a meaningful benefit.
* Validate data received from untrusted clients.
* Never rely exclusively on the frontend for authorization or security decisions.
* Avoid committing secrets, credentials, tokens, private keys, or environment-specific configuration.
* Add or update tests when changing important behavior.

For realtime functionality, treat WebSocket messages as an external API. New events should have clearly defined payloads and appropriate validation and authorization.

Pull Requests

Pull requests should:

* Have a clear title and description.
* Explain what problem is being solved.
* Describe significant implementation decisions when relevant.
* Remain focused on the intended change.
* Include tests where appropriate.
* Pass the project’s automated checks.

Screenshots or recordings are encouraged for significant visual changes.

A pull request may be requested to change before being merged. This is a normal part of the review process.

Security

Do not publicly report or submit fixes for previously undisclosed security vulnerabilities through normal issues or pull requests.

Please follow the instructions in SECURITY.md to report security vulnerabilities privately.

Licensing

Huddle is licensed under the GNU Affero General Public License version 3.0 (AGPL-3.0-only).

By submitting a contribution to Huddle, you agree that your contribution may be distributed under the same license as the project.

You also represent that you have the right to submit the contribution.

Do not submit code, assets, or other material that you do not have permission to distribute under terms compatible with the Huddle license.

AI-Assisted Contributions

The use of AI-assisted development tools is allowed.

Contributors remain responsible for understanding, reviewing, testing, and ensuring the correctness and licensing compatibility of any code or content they submit.

Pull requests containing large amounts of unreviewed or unexplained generated code may be rejected.

Community

Be respectful and constructive when interacting with maintainers and other contributors.

Technical disagreement is welcome. Personal attacks, harassment, discrimination, or abusive behavior are not.

The goal is to build Huddle collaboratively while maintaining a healthy environment for contributors and users.
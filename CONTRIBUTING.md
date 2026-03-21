# Contributing to Githelp Support Frontend

Thank you for your interest in contributing. This document explains how to get involved, from reporting issues to submitting code.

## Code of conduct

- Be respectful and inclusive. We aim to maintain a welcoming environment for everyone.
- Focus on constructive feedback. Critique the work, not the person.
- If you experience or witness unacceptable behavior, please report it to the maintainers.

## How you can contribute

- **Report bugs** — Open an issue with steps to reproduce, expected vs actual behavior, and your environment (browser, OS, Node/npm versions).
- **Suggest features or improvements** — Use the issue tracker to propose ideas or discuss changes before implementing.
- **Improve documentation** — Fix typos, clarify wording, or add examples in docs, README, or code comments.
- **Submit code** — Follow the workflow below for patches and pull requests.

## Development setup

1. **Clone and install**
   - Clone the repository and run `npm install` in the frontend directory.

2. **Branch**
   - Create a branch from the default branch (e.g. `main` or `develop`):  
     `git checkout -b your-name/short-description`

3. **Make changes**
   - Keep commits focused and messages clear (e.g. “Fix ticket list loading for helpers”, “Add CONTRIBUTING.md”).
   - Follow existing code style and patterns in the project.
   - Add or update tests when adding or changing behavior; the project uses Vitest and React Testing Library. Run `npm run test` to execute tests.

4. **Run checks**
   - Lint and type-check: `npm run lint`, `npm run build` (or equivalent) and fix any failures.
   - Tests: `npm run test` (recommended when you change behavior).

## Submitting changes

1. **Push** your branch and open a **pull request** (PR) against the default branch.
2. **Describe** what the PR does and why (link any related issues).
3. **Respond** to review comments and update the PR as needed.
4. **Wait for review** — a maintainer will review and may request changes before merging.

By submitting a pull request, you agree that your contributions may be used under the project’s license (AGPL-3.0). See [LICENSE](LICENSE) for full terms.

## License

Contributions you submit will be licensed under the same license as the project: **GNU Affero General Public License v3.0 (AGPL-3.0)**. If you do not agree with these terms, please do not submit code or documentation.

Thank you for contributing.

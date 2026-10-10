# Governance

## Roles

- **Maintainers** review and merge pull requests, triage issues, cut releases and hold the signing and release secrets. Current maintainers: [@gavenrobertson](https://github.com/gavenrobertson) (lead).
- **Contributors** are everyone who opens an issue, reviews a change or submits a pull request.
- **Area owners** (listed in [`.github/CODEOWNERS`](.github/CODEOWNERS)) are maintainers or trusted contributors responsible for a part of the codebase, such as the device library.

## Decisions

- Day-to-day changes are decided in pull requests. Changes from outside contributors need one maintainer approval; CI must be green.
- Significant technical decisions are written up as an [Architecture Decision Record](docs/adr/) in a pull request and stay open for comment for at least seven days. Smaller choices go in [`docs/decisions-log.md`](docs/decisions-log.md).
- The [specification](docs/SPEC.md) defines scope. Proposals that move toward the out-of-scope list (simulation, live discovery, credential storage, pushing config, cloud sync) need an ADR and maintainer consensus.
- If maintainers disagree, the lead maintainer decides after discussion, and the reasoning is recorded in the PR or ADR.

## Becoming a maintainer

Contributors with a sustained record of good reviews and contributions may be invited by the existing maintainers by consensus. Maintainers who are inactive for a year may be moved to emeritus status.

## Releases

Releases follow [Semantic Versioning](https://semver.org/) and are built only by GitHub Actions from a version tag (see [docs/dev/release.md](docs/dev/release.md)). A maintainer reviews the draft release before publishing it.

## Code of conduct

Everyone participating follows the [Code of Conduct](CODE_OF_CONDUCT.md).

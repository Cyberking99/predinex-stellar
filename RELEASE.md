# Release Process

This document outlines the release checklist and version tagging process for Predinex Stellar.

## 📋 Release Checklist

Before tagging a new release, ensure the following steps are completed:

### 1. Verification
- [ ] **Web Build**: Run `npm run build` in the `web` directory.
- [ ] **Contract Tests**: Run `cargo test` in `contracts/predinex`.
- [ ] **Linting**: Ensure `npm run lint` and `cargo fmt --check` / `cargo clippy` pass.
- [ ] **Environment**: Verify `.env.production` (if applicable) and contract IDs are correct for the target network.

### 2. Documentation
- [ ] **Version Bump**: Update version in `web/package.json` and `contracts/predinex/Cargo.toml`.
- [ ] **Changelog**: Update `CHANGELOG.md` with new features, fixes, and breaking changes.
- [ ] **README**: Ensure all setup instructions and architecture diagrams are up to date.

### 3. Tagging & Branching
- [ ] **Main Sync**: Ensure your local `main` branch is up to date with the remote.
- [ ] **Merge**: All features for the release should be merged into `main`.
- [ ] **Tag**: Create a new version tag (see [Version Tagging](#-version-tagging)).

---

## 🏷 Version Tagging

We follow [Semantic Versioning](https://semver.org/) (`vMAJOR.MINOR.PATCH`).

### Automated Tagging (GitHub Actions)
You can trigger the **Tag Release** workflow manually from the GitHub Actions tab:
1. Navigate to **Actions** > **Tag Release**.
2. Click **Run workflow**.
3. Enter the new version number (e.g., `v1.2.3`).
4. Click **Run workflow**.

### Manual Tagging
If you prefer to tag manually:
```bash
# Create the tag
git tag -a v1.2.3 -m "Release v1.2.3"

# Push the tag to origin
git push origin v1.2.3
```

---

## 📝 Changelog Template
Add a new entry to `CHANGELOG.md` using this format:

```markdown
## [v1.2.3] - 2026-03-25
### Added
- Feature description here.
### Fixed
- Bug fix description here.
### Changed
- Refinement description here.
```

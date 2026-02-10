# Repository Audit

Date: 2026-02-10
Repository: `blackout` (Element Web fork)

## Scope

This audit focused on:

- Dependency/security scanning feasibility in the current environment.
- Baseline quality gates (type-checking).
- Quick static review for common XSS/injection/secret-exposure risk patterns.
- Configuration review for externally exposed keys/endpoints.

## Commands Run

- `yarn audit --level moderate --json`
- `yarn -s lint:types:src`
- `rg -n "dangerouslySetInnerHTML|innerHTML\s*=|eval\(|new Function\(|document\.write\(" src test module_system | head -n 200`
- `rg -n "BEGIN (RSA|EC|OPENSSH|PRIVATE) KEY|AKIA[0-9A-Z]{16}|SECRET_KEY|API_KEY\s*=|password\s*=\s*['\"]" --glob '!yarn.lock' --glob '!package-lock.json' --glob '!.git' . | head -n 200`
- `sed -n '1,220p' element.io/app/config.json`

## Findings

### 1) Dependency audit could not complete in this environment

`yarn audit` failed with a registry tunnel/proxy error (`statusCode=403`) against `https://registry.yarnpkg.com/-/npm/v1/security/audits`.

**Risk:** Unknown dependency vulnerability status from this execution environment.

**Recommendation:**

- Re-run dependency audit in CI or a network path that can reach the Yarn/NPM security advisory endpoint.
- Add automated gating for dependency vulnerabilities (e.g., GitHub Dependabot + CI fail threshold).

### 2) Type-check baseline currently fails

`yarn -s lint:types:src` failed with multiple TypeScript errors, including:

- Missing declaration/module-resolution issues for `@vector-im/matrix-wysiwyg`.
- Type incompatibilities around `Uint8Array<ArrayBufferLike>` vs `Uint8Array<ArrayBuffer>`.
- Additional TS diagnostics (`TS6133`, `TS2554`, etc.).

**Risk:** Increases probability of runtime defects and makes regression detection harder.

**Recommendation:**

- Restore a green type-check baseline before further feature work.
- Prioritize resolver/typing issues around `@vector-im/matrix-wysiwyg` and cryptography/steganography typed-array constraints.

### 3) High-risk rendering sinks exist and require continuous sanitization discipline

The codebase includes multiple uses of `dangerouslySetInnerHTML` and `.innerHTML` assignments in production sources (for example in HTML utilities, embedded page rendering, syntax highlighting, and mobile guide/jitsi related files).

**Risk:** XSS exposure if any unsanitized/untrusted string reaches these sinks.

**Recommendation:**

- Maintain an explicit inventory of all HTML sinks and their sanitizer/path assumptions.
- Add unit tests that assert sanitization behavior at each sink boundary.
- Prefer safe DOM APIs / text insertion (`textContent`) where rich HTML is not strictly required.

### 4) Public config includes hardcoded third-party service identifiers/keys

`element.io/app/config.json` includes values such as:

- PostHog `project_api_key`
- MapTiler URL with inline key
- External integration endpoints

**Risk:** Even when intended as public client-side keys, they can be reused/abused (quota burn, telemetry spoofing, policy drift) if not constrained server-side.

**Recommendation:**

- Ensure all exposed keys are treated as public and restricted by origin/usage policy.
- Document key rotation and abuse-response playbooks.
- Consider environment-specific injection for deploy-time values to reduce accidental cross-environment leakage.

### 5) Repository cleanliness note

A pre-existing modified file was present before this audit work:

- `packages/shared-components/yarn.lock`

**Risk:** Not directly a security issue, but can complicate forensic attribution for future changes.

**Recommendation:**

- Keep working tree clean before running formal audits and releases.

## Priority Remediation Plan

1. **Unblock dependency auditing in CI/network path** and fail builds on severe vulnerabilities.
2. **Fix type-check pipeline to green** (module declarations and typed-array compatibility).
3. **Create/automate XSS sink review** with sink-by-sink tests.
4. **Harden policy around public client keys** (restriction, rotation, observability).

## Audit Confidence

- **Moderate** for code-pattern and config observations.
- **Low** for dependency vulnerability conclusions due to audit endpoint connectivity failure.

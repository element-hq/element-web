## Monorepo

Some words about the structure of monorepo we are using here.

### Structure

The monorepo is focused around multiple Typescript projects coming together to form an Element Web & Element Desktop app.
Some of the underlying typescript projects are useful for re-use elsewhere,
e.g. `@element-hq/web-shared-components` is reused by https://github.com/element-hq/aurora.

- `apps` - this directory holds the apps we build, `element-web` & `element-desktop`
    - Things in here are not published to npm
    - Things in here have very non-standard publishing steps, e.g. Element Desktop `.deb` ships via reprepro.
    - Things in here are in lock-step versions with each other
    - Things in here are represented as a group in Immutable Github Releases
    - Things in here support pre-releases & hotfixes
- `packages` - this directory holds some npm packages we maintain in order to build the `apps`
    - Things in here are published to npm
    - Things in here respect SemVer
    - Things in here are independently versioned
    - Things in here have a very simple publishing stage of `pnpm publish`
    - Things in here do not support pre-releases & hotfixes
- `modules` - this directory will hold some Element Web/Desktop modules we maintain in order to add environment-specific functionalities atop Element
    - Things in here are not published to npm

### Branches

- `develop` - this is the default branch and should always be buildable, this is what developers use as a base branch for their pull requests
    - Deployed via CD to develop.element.io
- #TODO should we just use short-lived release branches? We'd need to effectively interlace them for the various packages which feels messy
- `staging` - this branch is used to build the latest/next release.
    - During a normal release cycle, `develop` is merged into `staging` to "cut" a release candidate
        - Additional changes such as version bumps & changelogs are committed on top
    - During a hotfix/security release, changes are directly cherry-picked to `staging` to "cut" a release based on the last release rather than `develop`
    - When a release is finished, i.e. we've shipped the final release for a given version, we merge `staging->develop` to maintain continuity
- `backport/*` - these branches are used for cherry-picking entire pull requests from `develop` to `staging`, either to patch a release candidate, or to perform a hotfix release
- `<username>/*` - these feature branches are used for development, and may branch off `develop` or another feature branch

### Tags

- `v*` - these tags are used by the releases shown in the Github Releases UI, as in, the overall app release group
- `<package>@*` - these tags represent the release state of an individual npm package from the `packages/*` dir

Ultimately, the treatment of the 3 types of submodules we host in this repository is quite asymmetrical but this is by design,
to simplify processes around projects which do not need the complexities of element-web & element-desktop.

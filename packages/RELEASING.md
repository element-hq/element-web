# Release process for packages in element-web/packages

1. Update `package.json` with the new version. One way to do this is
   `pnpm version --no-git-tag-version <major|minor|patch>`. Or just do it manually.

2. Commit to a release prep branch, and open a PR.

3. Once the PR has merged to `develop`, run the
   [npm-publish](https://github.com/element-hq/element-web/actions/workflows/npm-publish.yaml)
   Github Actions workflow, specifying the package to be released.

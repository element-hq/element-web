# Releasing a Module

To make a release of a module:

1. Make a PR to bump the module's version in package.json, taking care to bump the version respecting SemVer.
1. Get it merged.
1. Push a signed tag pointing to the squash commit in the format `module/<module name>/v<version>`.

So to release version 88.77.66 of the banner module as commit hash abcedf:

```bash
git tag -s -m module/banner/v88.77.66 abcedf
git push origin v88.77.66
```

The [automation](https://github.com/element-hq/element-web/actions/workflows/release-module.yml) will create a draft
release. Once it's done, check it and, if it looks good, publish the release.

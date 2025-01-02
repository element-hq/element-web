# Module system

The module system in Element Web is a way to add or modify functionality of Element Web itself, bundled at compile time
for the app. This means that modules are loaded as part of the `yarn build` process but have an effect on user experience
at runtime.

## Installing modules

If you already have a module you want to install, such as our [ILAG Module](https://github.com/element-hq/element-web-ilag-module),
then copy `build_config.sample.yaml` to `build_config.yaml` in the same directory. In your new `build_config.yaml` simply
add the reference to the module as described by the sample file, using the same syntax you would for `yarn add`:

```yaml
modules:
    # Our module happens to be published on NPM, so we use that syntax to reference it.
    - "@vector-im/element-web-ilag-module@latest"
```

Then build the app as you normally would: `yarn build` or `yarn dist` (if compatible on your platform). If you are building
the Docker image then ensure your `build_config.yaml` ends up in the build directory. Usually this works fine if you use
the current directory as the build context (the `.` in `docker build -t my-element-web .`).

## Writing modules

While writing modules is meant to be easy, not everything is possible yet. For modules which want to do something we haven't
exposed in the module API, the module API will need to be updated. This means a PR to both this repo
and [`matrix-react-sdk-module-api`](https://github.com/matrix-org/matrix-react-sdk-module-api).

Once your change to the module API is accepted, the `@matrix-org/react-sdk-module-api` dependency gets updated at the
`element-web` layer (usually by us, the maintainers) to ensure your module can operate.

If you're not adding anything to the module API, or your change was accepted per above, then start off with a clone of
our [ILAG module](https://github.com/element-hq/element-web-ilag-module) which will give you a general idea for what the
structure of a module is and how it works.

The following requirements are key for any module:

1. The module must depend on `@matrix-org/react-sdk-module-api` (usually as a dev dependency).
2. The module's `main` entrypoint must have a `default` export for the `RuntimeModule` instance, supporting a constructor
   which takes a single parameter: a `ModuleApi` instance. This instance is passed to `super()`.
3. The module must be deployed in a way where `yarn add` can access it, as that is how the build system will try to
   install it. Note that while this is often NPM, it can also be a GitHub/GitLab repo or private NPM registry.
   Be careful when using git dependencies in yarn classic, many lifecycle scripts will not be executed which may mean
   that your module is not built and thus may fail to be imported.

... and that's pretty much it. As with any code, please be responsible and call things in line with the documentation.
Both `RuntimeModule` and `ModuleApi` have extensive documentation to describe what is proper usage and how to set things
up.

If you have any questions then please visit [#element-dev:matrix.org](https://matrix.to/#/#element-dev:matrix.org) on
Matrix and we'll help as best we can.

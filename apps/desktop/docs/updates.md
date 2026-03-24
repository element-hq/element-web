The Desktop app is capable of self-updating on macOS and Windows.
The update server base url is configurable as `update_base_url` in config.json and can be served by a static file host,
CDN or object storage.

Currently all packaging & deployment is handled by [Github actions](https://github.com/vector-im/element-desktop/blob/develop/.github/workflows/build_and_deploy.yaml)

# Windows

On Windows the update mechanism used is [Squirrel.Windows](https://github.com/Squirrel/Squirrel.Windows)
and can be served by any compatible Squirrel server, such as https://github.com/Tiliq/squirrel-server

# macOS

On macOS the update mechanism used is [Squirrel.Mac](https://github.com/Squirrel/Squirrel.Mac)
using the newer JSON format as documented [here](https://github.com/Squirrel/Squirrel.Mac#update-file-json-format).

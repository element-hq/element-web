# @element-hq/element-web-module-api

API surface for extending Element Web in a safe & predictable way.

This project is still in early development but aims to replace matrix-react-sdk-module-api and Element Web deprecated customisations.

## Using the Docker image

The docker image specified by the Dockerfile in this directory can be used in one of four ways.

You can specify `ELEMENT_WEB_MODULES` as a build-arg or as a runtime environment variable to fetch & load a module
from a remote URL at runtime or to bundle it into the docker image for easier deployment respectively.
The format this variable should take is a comma-delimited list of URLs followed by the optional tarball hash after a `#` character, e.g.
`ELEMENT_WEB_MODULES=https://example.com/module.tgz#abc123,https://example.com/another-module.tgz#`.

You can also use it as a base image and add your desired modules into `/tmp/element-web-modules` each in their own directory.
Finally, you can bind mount modules into the `/tmp/element-web-modules` directory at runtime.
The default entrypoint will be index.js in that directory but can be overriden if a package.json file is found with a `main` directive.

The container expects a config.json file to be bind mounted or copied into the `/app/config.json` path.
The container runs an nginx web server in rootless mode on port 8080.
If you wish to use docker in read-only mode, you should follow the [upstream instructions](https://hub.docker.com/_/nginx#:~:text=Running%20nginx%20in%20read%2Donly%20mode)
but additionally include the following directories:

- /tmp/element-web-modules/
- /tmp/element-web-config/
- /etc/nginx/conf.d/

## Using the API

Modules are loaded by Element Web at runtime via a dynamic ecmascript import, but can be bundled into a webapp for deployment convenience.

The module's default export MUST be a class which accepts a single argument, an instance of `ModuleApi`.
This class must also bear a static property `moduleApiVersion` which is a semver range string
and a `load` method which is called when the module is to be loaded.

```typescript
import type { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";

class ExampleModule implements Module {
    public static readonly moduleApiVersion = "^0.1.0";

    public constructor(private api: Api) {}

    public async load(): Promise<void> {
        // Your extension code goes here
    }
}

export default ExampleModule satisfies ModuleFactory;
```

### Accessing application configuration

The `api` object passed to the module constructor provides access to the application configuration.
You can extend the Config types using declaration merging, though please ensure that you do not trust the types you specify,
and opt for runtime validation due to the dynamic nature of the configuration.

```typescript
// ...
declare module "@element-hq/element-web-module-api" {
    interface Config {
        "this.is.my.config.key": string;
    }
}

class ExampleModule implements Module {
    // ...
    public async load(): Promise<void> {
        const configValue = this.api.config.get("this.is.my.config.key");
        // Your extension code goes here
    }
}
// ...
```

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.

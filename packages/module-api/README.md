# @element-hq/element-web-module-api

API surface for extending Element Web in a safe & predictable way.

## Using the API

Modules are loaded by Element Web at runtime via a dynamic ecmascript import, but can be bundled into a webapp for deployment convenience.

The module's default export MUST be a class which accepts a single argument, an instance of `ModuleApi`.
This class must also bear a static property `moduleApiVersion` which is a semver range string
and a `load` method which is called when the module is to be loaded.

```typescript
import type { Module, Api, ModuleFactory } from "@element-hq/element-web-module-api";

class ExampleModule implements Module {
    public static readonly moduleApiVersion = "^2.0.0";

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

### Using settings

Modules can register their own settings and read or write them through `api.settings`.

Declare the type of each setting using declaration merging on `ModuleSettingValues`. The usual place for this is an
`index.d.ts` file in your module's source folder:

```typescript
// index.d.ts
import "@element-hq/element-web-module-api";

declare module "@element-hq/element-web-module-api" {
    interface ModuleSettingValues {
        "module.exampleModule.enabled": boolean;
    }
}
```

Then register the settings with their default values in `load`:

```typescript
import { Level } from "@element-hq/element-web-module-api";
// ...
class ExampleModule implements Module {
    // ...
    public async load(): Promise<void> {
        this.api.settings.registerSettings({
            "module.exampleModule.enabled": { default: false, supportedLevels: [Level.DEVICE] },
        });
    }
}
// ...
```

- Setting names must be of the form `module.<your module name>.<setting name>`, for example
  `module.exampleModule.enabled`. Including your module's name avoids clashing with other modules.
- Each setting can only be registered once. Registering a name that is already registered throws an error.
- Settings must be registered before they are read or written.

```typescript
// Watchable<boolean>
const enabled = this.api.settings.getValueWatchable("module.exampleModule.enabled");
console.log(enabled.value);
enabled.watch((value) => console.log("Setting changed to", value));

await this.api.settings.setValue("module.exampleModule.enabled", null, Level.DEVICE, true);

// Type errors: the value must be a boolean, and undeclared module settings are rejected
await this.api.settings.setValue("module.exampleModule.enabled", null, Level.DEVICE, "yes");
this.api.settings.getValueWatchable("module.exampleModule.typo");
```

`getValueWatchable` returns a `Watchable` that updates when the setting changes.

Element Web's own settings can be read and written too, by name. They are not typed by this package, so their values
are `any`:

```typescript
const language: Watchable<string> = this.api.settings.getValueWatchable("language");
```

## Releases

The API is versioned using semver, with the major version incremented for breaking changes.

To carry out a release, see the documentation at [`../RELEASING.md`](../RELEASING.md).

## Copyright & License

Copyright (c) 2025 New Vector Ltd

This software is multi licensed by New Vector Ltd (Element). It can be used either:

(1) for free under the terms of the GNU Affero General Public License (as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version); OR

(2) under the terms of a paid-for Element Commercial License agreement between you and Element (the terms of which may vary depending on what you and Element have agreed to).
Unless required by applicable law or agreed to in writing, software distributed under the Licenses is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the Licenses for the specific language governing permissions and limitations under the Licenses.

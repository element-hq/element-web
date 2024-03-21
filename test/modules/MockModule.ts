/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { RuntimeModule } from "@matrix-org/react-sdk-module-api/lib/RuntimeModule";
import { ModuleApi } from "@matrix-org/react-sdk-module-api/lib/ModuleApi";

import { ModuleRunner } from "../../src/modules/ModuleRunner";

export class MockModule extends RuntimeModule {
    public get apiInstance(): ModuleApi {
        return this.moduleApi;
    }

    public constructor(moduleApi: ModuleApi) {
        super(moduleApi);
    }
}

export function registerMockModule(): MockModule {
    let module: MockModule | undefined;
    ModuleRunner.instance.registerModule((api) => {
        if (module) {
            throw new Error("State machine error: ModuleRunner created the module twice");
        }
        module = new MockModule(api);
        return module;
    });
    if (!module) {
        throw new Error("State machine error: ModuleRunner did not create module");
    }
    return module;
}

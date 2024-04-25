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
import { AllExtensions } from "@matrix-org/react-sdk-module-api/lib/types/extensions";
import {
    CryptoSetupExtensionsBase,
    ExtendedMatrixClientCreds,
    SecretStorageKeyDescriptionAesV1,
    CryptoSetupArgs,
} from "@matrix-org/react-sdk-module-api/lib/lifecycles/CryptoSetupExtensions";

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

export class MockModuleWithCryptoSetupExtension extends RuntimeModule {
    public get apiInstance(): ModuleApi {
        return this.moduleApi;
    }

    moduleName: string = MockModuleWithCryptoSetupExtension.name;

    extensions: AllExtensions = {
        cryptoSetup: new (class extends CryptoSetupExtensionsBase {
            SHOW_ENCRYPTION_SETUP_UI = true;

            examineLoginResponse(response: any, credentials: ExtendedMatrixClientCreds): void {
                throw new Error("Method not implemented.");
            }
            persistCredentials(credentials: ExtendedMatrixClientCreds): void {
                throw new Error("Method not implemented.");
            }
            getSecretStorageKey(): Uint8Array | null {
                return Uint8Array.from([0x11, 0x22, 0x99]);
            }
            createSecretStorageKey(): Uint8Array | null {
                throw new Error("Method not implemented.");
            }
            catchAccessSecretStorageError(e: Error): void {
                throw new Error("Method not implemented.");
            }
            setupEncryptionNeeded(args: CryptoSetupArgs): boolean {
                throw new Error("Method not implemented.");
            }
            getDehydrationKeyCallback():
                | ((
                      keyInfo: SecretStorageKeyDescriptionAesV1,
                      checkFunc: (key: Uint8Array) => void,
                  ) => Promise<Uint8Array>)
                | null {
                throw new Error("Method not implemented.");
            }
        })(),
    };

    public constructor(moduleApi: ModuleApi) {
        super(moduleApi);
    }
}

export function registerMockModuleWithCryptoSetupExtension(): MockModuleWithCryptoSetupExtension {
    let module: MockModuleWithCryptoSetupExtension | undefined;

    ModuleRunner.instance.registerModule((api) => {
        if (module) {
            throw new Error("State machine error: ModuleRunner created the module twice");
        }
        module = new MockModuleWithCryptoSetupExtension(api);
        return module;
    });
    if (!module) {
        throw new Error("State machine error: ModuleRunner did not create module");
    }
    return module;
}

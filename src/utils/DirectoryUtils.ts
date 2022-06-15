/*
Copyright 2018, 2022 The Matrix.org Foundation C.I.C.

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

import { IInstance, IProtocol } from "matrix-js-sdk/src/client";

// XXX: We would ideally use a symbol here but we can't since we save this value to localStorage
export const ALL_ROOMS = "ALL_ROOMS";

export type Protocols = Record<string, IProtocol>;

// Find a protocol 'instance' with a given instance_id
// in the supplied protocols dict
export function instanceForInstanceId(protocols: Protocols, instanceId: string | null | undefined): IInstance | null {
    if (!instanceId) return null;
    for (const proto of Object.keys(protocols)) {
        if (!protocols[proto].instances && protocols[proto].instances instanceof Array) continue;
        for (const instance of protocols[proto].instances) {
            if (instance.instance_id == instanceId) return instance;
        }
    }
    return null;
}

// given an instance_id, return the name of the protocol for
// that instance ID in the supplied protocols dict
export function protocolNameForInstanceId(protocols: Protocols, instanceId: string | null | undefined): string | null {
    if (!instanceId) return null;
    for (const proto of Object.keys(protocols)) {
        if (!protocols[proto].instances && protocols[proto].instances instanceof Array) continue;
        for (const instance of protocols[proto].instances) {
            if (instance.instance_id == instanceId) return proto;
        }
    }
    return null;
}

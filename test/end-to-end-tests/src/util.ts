/*
Copyright 2018 New Vector Ltd
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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

import { ElementSession } from "./session";

export const range = function(start: number, amount: number, step = 1): Array<number> {
    const r = [];
    for (let i = 0; i < amount; ++i) {
        r.push(start + (i * step));
    }
    return r;
};

export const delay = function(ms): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
};

export const measureStart = function(session: ElementSession, name: string): Promise<void> {
    return session.page.evaluate(_name => {
        window.mxPerformanceMonitor.start(_name);
    }, name);
};

export const measureStop = function(session: ElementSession, name: string): Promise<void> {
    return session.page.evaluate(_name => {
        window.mxPerformanceMonitor.stop(_name);
    }, name);
};

// TODO: Proper types on `config` - for some reason won't accept an import of ConfigOptions.
export async function applyConfigChange(session: ElementSession, config: any): Promise<void> {
    await session.page.evaluate((_config) => {
        // note: we can't *set* the object because the window version is effectively a pointer.
        for (const [k, v] of Object.entries(_config)) {
            // @ts-ignore - for some reason it's not picking up on global.d.ts types.
            window.mxReactSdkConfig[k] = v;
        }
    }, config);
}

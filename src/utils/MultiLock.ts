/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import { EnhancedMap } from "./maps";
import AwaitLock from "await-lock";

export type DoneFn = () => void;

export class MultiLock {
    private locks = new EnhancedMap<string, AwaitLock>();

    public async acquire(key: string): Promise<DoneFn> {
        const lock = this.locks.getOrCreate(key, new AwaitLock());
        await lock.acquireAsync();
        return () => lock.release();
    }
}

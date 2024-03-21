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

/**
 * Utility class for lazily getting a variable.
 */
export class LazyValue<T> {
    private val?: T;
    private prom?: Promise<T>;
    private done = false;

    public constructor(private getFn: () => Promise<T>) {}

    /**
     * Whether or not a cached value is present.
     */
    public get present(): boolean {
        // we use a tracking variable just in case the final value is falsy
        return this.done;
    }

    /**
     * Gets the value without invoking a get. May be undefined until the
     * value is fetched properly.
     */
    public get cachedValue(): T | undefined {
        return this.val;
    }

    /**
     * Gets a promise which resolves to the value, eventually.
     */
    public get value(): Promise<T> {
        if (this.prom) return this.prom;
        this.prom = this.getFn();

        return this.prom.then((v) => {
            this.val = v;
            this.done = true;
            return v;
        });
    }
}

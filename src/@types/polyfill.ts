/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

// This is intended to fix re-resizer because of its unguarded `instanceof TouchEvent` checks.
export function polyfillTouchEvent(): void {
    // Firefox doesn't have touch events without touch devices being present, so create a fake
    // one we can rely on lying about.
    if (!window.TouchEvent) {
        // We have no intention of actually using this, so just lie.
        window.TouchEvent = class TouchEvent extends UIEvent {
            public get altKey(): boolean {
                return false;
            }
            public get changedTouches(): any {
                return [];
            }
            public get ctrlKey(): boolean {
                return false;
            }
            public get metaKey(): boolean {
                return false;
            }
            public get shiftKey(): boolean {
                return false;
            }
            public get targetTouches(): any {
                return [];
            }
            public get touches(): any {
                return [];
            }
            public get rotation(): number {
                return 0.0;
            }
            public get scale(): number {
                return 0.0;
            }
            public constructor(eventType: string, params?: any) {
                super(eventType, params);
            }
        };
    }
}

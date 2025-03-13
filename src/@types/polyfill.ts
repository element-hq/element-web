/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
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

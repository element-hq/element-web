/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

declare module "diff-dom" {
    export interface IDiff {
        action: string;
        name: string;
        text?: string;
        route: number[];
        value: HTMLElement | string;
        element: HTMLElement | string;
        oldValue: HTMLElement | string;
        newValue: HTMLElement | string;
    }

    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface IOpts {}

    export class DiffDOM {
        public constructor(opts?: IOpts);
        public apply(tree: unknown, diffs: IDiff[]): unknown;
        public undo(tree: unknown, diffs: IDiff[]): unknown;
        public diff(a: HTMLElement | string, b: HTMLElement | string): IDiff[];
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";

import { type ComponentClass } from "../@types/common";
import { UPDATE_EVENT } from "./AsyncStore";

export type ToastReference = symbol;

export default class NonUrgentToastStore extends EventEmitter {
    private static _instance: NonUrgentToastStore;

    private toasts = new Map<ToastReference, ComponentClass>();

    public static get instance(): NonUrgentToastStore {
        if (!NonUrgentToastStore._instance) {
            NonUrgentToastStore._instance = new NonUrgentToastStore();
        }
        return NonUrgentToastStore._instance;
    }

    public get components(): ComponentClass[] {
        return Array.from(this.toasts.values());
    }

    public addToast(c: ComponentClass): ToastReference {
        const ref: ToastReference = Symbol();
        this.toasts.set(ref, c);
        this.emit(UPDATE_EVENT);
        return ref;
    }

    public removeToast(ref: ToastReference): void {
        this.toasts.delete(ref);
        this.emit(UPDATE_EVENT);
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";
import { logger } from "matrix-js-sdk/src/logger";

import type React from "react";
import { type ComponentClass } from "../@types/common";

export interface IToast<C extends ComponentClass> {
    key: string;
    // higher priority number will be shown on top of lower priority
    priority: number;
    title?: string;
    icon?: string;
    component: C;
    className?: string;
    bodyClassName?: string;
    props?: Omit<React.ComponentProps<C>, "toastKey">; // toastKey is injected by ToastContainer
}

/**
 * Holds the active toasts
 */
export default class ToastStore extends EventEmitter {
    private toasts: IToast<any>[] = [];
    // The count of toasts which have been seen & dealt with in this stack
    // where the count resets when the stack of toasts clears.
    private countSeen = 0;

    public static sharedInstance(): ToastStore {
        if (!window.mxToastStore) window.mxToastStore = new ToastStore();
        return window.mxToastStore;
    }

    public reset(): void {
        this.toasts = [];
        this.countSeen = 0;
    }

    /**
     * Add or replace a toast
     * If a toast with the same toastKey already exists, the given toast will replace it
     * Toasts are always added underneath any toasts of the same priority, so existing
     * toasts stay at the top unless a higher priority one arrives (better to not change the
     * toast unless necessary).
     *
     * @param {object} newToast The new toast
     */
    public addOrReplaceToast<C extends ComponentClass>(newToast: IToast<C>): void {
        const oldIndex = this.toasts.findIndex((t) => t.key === newToast.key);
        if (oldIndex === -1) {
            logger.info(`Opening toast with key '${newToast.key}': title '${newToast.title}'`);
            let newIndex = this.toasts.length;
            while (newIndex > 0 && this.toasts[newIndex - 1].priority < newToast.priority) --newIndex;
            this.toasts.splice(newIndex, 0, newToast);
        } else {
            logger.info(`Replacing existing toast with key '${newToast.key}': title now '${newToast.title}'`);
            this.toasts[oldIndex] = newToast;
        }
        this.emit("update");
    }

    public dismissToast(key: string): void {
        if (this.toasts[0] && this.toasts[0].key === key) {
            this.countSeen++;
        }

        const length = this.toasts.length;
        this.toasts = this.toasts.filter((t) => t.key !== key);
        if (length !== this.toasts.length) {
            logger.info(`Removed toast with key '${key}'`);
            if (this.toasts.length === 0) {
                this.countSeen = 0;
            }

            this.emit("update");
        }
    }

    public getToasts(): IToast<any>[] {
        return this.toasts;
    }

    public getCountSeen(): number {
        return this.countSeen;
    }
}

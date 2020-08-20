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

import EventEmitter from "events";
import React from "react";
import { ComponentClass } from "../@types/common";

export interface IToast<C extends ComponentClass> {
    key: string;
    // higher priority number will be shown on top of lower priority
    priority: number;
    title: string;
    icon?: string;
    component: C;
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

    static sharedInstance() {
        if (!window.mxToastStore) window.mxToastStore = new ToastStore();
        return window.mxToastStore;
    }

    reset() {
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
    addOrReplaceToast<C extends ComponentClass>(newToast: IToast<C>) {
        const oldIndex = this.toasts.findIndex(t => t.key === newToast.key);
        if (oldIndex === -1) {
            let newIndex = this.toasts.length;
            while (newIndex > 0 && this.toasts[newIndex - 1].priority < newToast.priority) --newIndex;
            this.toasts.splice(newIndex, 0, newToast);
        } else {
            this.toasts[oldIndex] = newToast;
        }
        this.emit('update');
    }

    dismissToast(key) {
        if (this.toasts[0] && this.toasts[0].key === key) {
            this.countSeen++;
        }

        const length = this.toasts.length;
        this.toasts = this.toasts.filter(t => t.key !== key);
        if (length !== this.toasts.length) {
            if (this.toasts.length === 0) {
                this.countSeen = 0;
            }

            this.emit('update');
        }
    }

    getToasts() {
        return this.toasts;
    }

    getCountSeen() {
        return this.countSeen;
    }
}

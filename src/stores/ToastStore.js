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

import EventEmitter from 'events';

/**
 * Holds the active toasts
 */
export default class ToastStore extends EventEmitter {
    static PRIORITY_REALTIME = 0;
    static PRIORITY_DEFAULT = 1;
    static PRIORITY_LOW = 2;

    static sharedInstance() {
        if (!global.mx_ToastStore) global.mx_ToastStore = new ToastStore();
        return global.mx_ToastStore;
    }

    constructor() {
        super();
        this._dispatcherRef = null;
        this._toasts = [];
    }

    reset() {
        this._toasts = [];
    }

    /**
     * Add or replace a toast
     * If a toast with the same toastKey already exists, the given toast will replace it
     * Toasts are always added underneath any toasts of the same priority, so existing
     * toasts stay at the top unless a higher priority one arrives (better to not change the
     * toast unless necessary).
     *
     * @param {boject} newToast The new toast
     */
    addOrReplaceToast(newToast) {
        if (newToast.priority === undefined) newToast.priority = ToastStore.PRIORITY_DEFAULT;

        const oldIndex = this._toasts.findIndex(t => t.key === newToast.key);
        if (oldIndex === -1) {
            let newIndex = this._toasts.length;
            while (newIndex > 0 && this._toasts[newIndex - 1].priority > newToast.priority) --newIndex;
            this._toasts.splice(newIndex, 0, newToast);
        } else {
            this._toasts[oldIndex] = newToast;
        }
        this.emit('update');
    }

    dismissToast(key) {
        this._toasts = this._toasts.filter(t => t.key !== key);
        this.emit('update');
    }

    getToasts() {
        return this._toasts;
    }
}

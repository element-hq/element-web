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
    static PRIORITY_REALTIME = 1;
    static PRIORITY_DEFAULT = 0;

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

    addOrReplaceToast(newToast) {
        if (newToast.priority === undefined) newToast.priority = ToastStore.PRIORITY_DEFAULT;

        const oldIndex = this._toasts.findIndex(t => t.key === newToast.key);
        if (oldIndex === -1) {
            // we only have two priorities so just push realtime ones onto the front
            if (newToast.priority) {
                this._toasts.unshift(newToast);
            } else {
                this._toasts.push(newToast);
            }
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

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

import { ComponentClass } from "../@types/common";
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

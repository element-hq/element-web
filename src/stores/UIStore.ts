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

export enum UI_EVENTS {
    Resize = "resize"
}

export type ResizeObserverCallbackFunction = (entries: ResizeObserverEntry[]) => void;


export default class UIStore extends EventEmitter {
    private static _instance: UIStore = null;

    private resizeObserver: ResizeObserver;

    public windowWith: number;
    public windowHeight: number;

    constructor() {
        super();

        this.windowWith = window.innerWidth;
        this.windowHeight = window.innerHeight;

        this.resizeObserver = new ResizeObserver(this.resizeObserverCallback);
        this.resizeObserver.observe(document.body);
    }

    public static get instance(): UIStore {
        if (!UIStore._instance) {
            UIStore._instance = new UIStore();
        }
        return UIStore._instance;
    }

    public static destroy(): void {
        if (UIStore._instance) {
            UIStore._instance.resizeObserver.disconnect();
            UIStore._instance.removeAllListeners();
            UIStore._instance = null;
        }
    }

    private resizeObserverCallback = (entries: ResizeObserverEntry[]) => {
        const { width, height } = entries
            .find(entry => entry.target === document.body)
            .contentRect;

        this.windowWith = width;
        this.windowHeight = height;

        this.emit(UI_EVENTS.Resize, entries);
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";

export enum UI_EVENTS {
    Resize = "resize",
}

export default class UIStore extends EventEmitter {
    private static _instance: UIStore | null = null;

    private resizeObserver: ResizeObserver;

    private uiElementDimensions = new Map<string, DOMRectReadOnly>();
    private trackedUiElements = new Map<Element, string>();

    public windowWidth: number;
    public windowHeight: number;

    public constructor() {
        super();

        // eslint-disable-next-line no-restricted-properties
        this.windowWidth = window.innerWidth;
        // eslint-disable-next-line no-restricted-properties
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

    public getElementDimensions(name: string): DOMRectReadOnly | undefined {
        return this.uiElementDimensions.get(name);
    }

    public trackElementDimensions(name: string, element: Element): void {
        this.trackedUiElements.set(element, name);
        this.resizeObserver.observe(element);
    }

    public stopTrackingElementDimensions(name: string): void {
        let trackedElement: Element | undefined;
        this.trackedUiElements.forEach((trackedElementName, element) => {
            if (trackedElementName === name) {
                trackedElement = element;
            }
        });
        if (trackedElement) {
            this.resizeObserver.unobserve(trackedElement);
            this.uiElementDimensions.delete(name);
            this.trackedUiElements.delete(trackedElement);
        }
    }

    public isTrackingElementDimensions(name: string): boolean {
        return this.uiElementDimensions.has(name);
    }

    private resizeObserverCallback = (entries: ResizeObserverEntry[]): void => {
        const windowEntry = entries.find((entry) => entry.target === document.body);

        if (windowEntry) {
            this.windowWidth = windowEntry.contentRect.width;
            this.windowHeight = windowEntry.contentRect.height;
        }

        entries.forEach((entry) => {
            const trackedElementName = this.trackedUiElements.get(entry.target);
            if (trackedElementName) {
                this.uiElementDimensions.set(trackedElementName, entry.contentRect);
                this.emit(trackedElementName, UI_EVENTS.Resize, entry);
            }
        });

        this.emit(UI_EVENTS.Resize, entries);
    };
}

window.mxUIStore = UIStore.instance;

/*
Copyright 2024 New Vector Ltd.
Copyright 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import EventEmitter from "events";

export enum UI_EVENTS {
    Resize = "resize",
    WidthIncreased = "width-increased",
    WidthDecreased = "width-decreased",
}

export default class UIStore extends EventEmitter {
    private static _instance: UIStore | null = null;

    private resizeObserver: ResizeObserver;

    private uiElementDimensions = new Map<string, DOMRectReadOnly>();
    private trackedUiElements = new Map<Element, string>();
    private timeoutId: number = 0;

    public windowWidth: number;
    public windowHeight: number;
    /**
     * Whether the window is currently being resized.
     */
    public isWindowBeingResized: boolean = false;

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
            window.mxUIStore = UIStore._instance;
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
            this.setWindowAsBeingResized();

            const currentWidth = windowEntry.contentRect.width;
            this.emitWidthChangeEvents(currentWidth);

            this.windowWidth = currentWidth;
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

    /**
     * Emit any necessary {@link UI_EVENTS.WidthIncreased} or {@link UI_EVENTS.WidthDecreased} events.
     * @param currentWidth The current width of {@link window}
     */
    private emitWidthChangeEvents = (currentWidth: number): void => {
        if (currentWidth > this.windowWidth) this.emit(UI_EVENTS.WidthIncreased, currentWidth);
        if (currentWidth < this.windowWidth) this.emit(UI_EVENTS.WidthDecreased, currentWidth);
    };

    /**
     * Update {@link UIStore#isWindowBeingResized}.
     */
    private setWindowAsBeingResized = (): void => {
        // Window is being resized, so set to true.
        this.isWindowBeingResized = true;
        // Reset any previous timeout.
        window.clearTimeout(this.timeoutId);
        // Set to false after a second.
        // If the window continues to be resized, this method will be called
        // again and this setTimeout will be cancelled.
        this.timeoutId = window.setTimeout(() => {
            this.isWindowBeingResized = false;
        }, 1000);
    };
}

    /**
     * Emit any necessary {@link UI_EVENTS.WidthIncreased} or {@link UI_EVENTS.WidthDecreased} events.
     * @param currentWidth The current width of {@link window}
     */
    private emitWidthChangeEvents = (currentWidth: number): void => {
        if (currentWidth > this.windowWidth) this.emit(UI_EVENTS.WidthIncreased, currentWidth);
        if (currentWidth < this.windowWidth) this.emit(UI_EVENTS.WidthDecreased, currentWidth);
    };

    /**
     * Update {@link UIStore#isWindowBeingResized}.
     */
    private setWindowAsBeingResized = (): void => {
        // Window is being resized, so set to true.
        this.isWindowBeingResized = true;
        // Reset any previous timeout.
        window.clearTimeout(this.timeoutId);
        // Set to false after a second.
        // If the window continues to be resized, this method will be called
        // again and this setTimeout will be cancelled.
        this.timeoutId = window.setTimeout(() => {
            this.isWindowBeingResized = false;
        }, 1000);
    };
}

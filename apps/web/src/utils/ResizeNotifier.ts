/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

/**
 * Fires when the middle panel has been resized (throttled).
 * @event module:utils~ResizeNotifier#"middlePanelResized"
 */
/**
 * Fires when the middle panel has been resized by a pixel.
 * @event module:utils~ResizeNotifier#"middlePanelResizedNoisy"
 */

import { EventEmitter } from "events";
import { throttle } from "lodash";

export default class ResizeNotifier extends EventEmitter {
    private _isResizing = false;

    // with default options, will call fn once at first call, and then every x ms
    // if there was another call in that timespan
    private throttledMiddlePanel = throttle(() => this.emit("middlePanelResized"), 200);

    public get isResizing(): boolean {
        return this._isResizing;
    }

    public startResizing(): void {
        this._isResizing = true;
        this.emit("isResizing", true);
    }

    public stopResizing(): void {
        this._isResizing = false;
        this.emit("isResizing", false);
    }

    private noisyMiddlePanel(): void {
        this.emit("middlePanelResizedNoisy");
    }

    private updateMiddlePanel(): void {
        this.throttledMiddlePanel();
        this.noisyMiddlePanel();
    }

    // can be called in quick succession
    public notifyLeftHandleResized(): void {
        // don't emit event for own region
        this.updateMiddlePanel();
    }

    // can be called in quick succession
    public notifyRightHandleResized(): void {
        this.updateMiddlePanel();
    }

    public notifyTimelineHeightChanged(): void {
        this.updateMiddlePanel();
    }

    // can be called in quick succession
    public notifyWindowResized(): void {
        this.updateMiddlePanel();
    }
}

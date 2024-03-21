/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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

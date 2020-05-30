/*
Copyright 2019 New Vector Ltd

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
 * Fires when the middle panel has been resized.
 * @event module:utils~ResizeNotifier#"middlePanelResized"
 */
import { EventEmitter } from "events";
import { throttle } from "lodash";

export default class ResizeNotifier extends EventEmitter {
    constructor() {
        super();
        // with default options, will call fn once at first call, and then every x ms
        // if there was another call in that timespan
        this._throttledMiddlePanel = throttle(() => this.emit("middlePanelResized"), 200);
    }

    // can be called in quick succession
    notifyLeftHandleResized() {
        // don't emit event for own region
        this._throttledMiddlePanel();
    }

    // can be called in quick succession
    notifyRightHandleResized() {
        this._throttledMiddlePanel();
    }

    // can be called in quick succession
    notifyWindowResized() {
        // no need to throttle this one,
        // also it could make scrollbars appear for
        // a split second when the room list manual layout is now
        // taller than the available space
        this.emit("leftPanelResized");

        this._throttledMiddlePanel();
    }
}


/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

// eslint-disable-next-line no-restricted-imports
import { EventEmitter } from "events";

import { ReEmitter } from "../../src/ReEmitter";

const EVENTNAME = "UnknownEntry";

class EventSource extends EventEmitter {
    doTheThing() {
        this.emit(EVENTNAME, "foo", "bar");
    }

    doAnError() {
        this.emit("error");
    }
}

class EventTarget extends EventEmitter {}

describe("ReEmitter", function () {
    it("Re-Emits events with the same args", function () {
        const src = new EventSource();
        const tgt = new EventTarget();

        const handler = jest.fn();
        tgt.on(EVENTNAME, handler);

        const reEmitter = new ReEmitter(tgt);
        reEmitter.reEmit(src, [EVENTNAME]);

        src.doTheThing();

        // Args should be the args passed to 'emit' after the event name, and
        // also the source object of the event which re-emitter adds
        expect(handler).toHaveBeenCalledWith("foo", "bar", src);
    });

    it("Doesn't throw if no handler for 'error' event", function () {
        const src = new EventSource();
        const tgt = new EventTarget();

        const reEmitter = new ReEmitter(tgt);
        reEmitter.reEmit(src, ["error"]);

        // without the workaround in ReEmitter, this would throw
        src.doAnError();

        const handler = jest.fn();
        tgt.on("error", handler);

        src.doAnError();

        // Now we've attached an error handler, it should be called
        expect(handler).toHaveBeenCalled();
    });
});

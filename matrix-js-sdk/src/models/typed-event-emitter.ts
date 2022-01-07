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

import { EventEmitter } from "events";

enum EventEmitterEvents {
    NewListener = "newListener",
    RemoveListener = "removeListener",
}

/**
 * Typed Event Emitter class which can act as a Base Model for all our model
 * and communication events.
 * This makes it much easier for us to distinguish between events, as we now need
 * to properly type this, so that our events are not stringly-based and prone
 * to silly typos.
 */
export abstract class TypedEventEmitter<Events extends string> extends EventEmitter {
    public addListener(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.addListener(event, listener);
    }

    public emit(event: Events | EventEmitterEvents, ...args: any[]): boolean {
        return super.emit(event, ...args);
    }

    public eventNames(): (Events | EventEmitterEvents)[] {
        return super.eventNames() as Events[];
    }

    public listenerCount(event: Events | EventEmitterEvents): number {
        return super.listenerCount(event);
    }

    public listeners(event: Events | EventEmitterEvents): Function[] {
        return super.listeners(event);
    }

    public off(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.off(event, listener);
    }

    public on(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.on(event, listener);
    }

    public once(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.once(event, listener);
    }

    public prependListener(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.prependListener(event, listener);
    }

    public prependOnceListener(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.prependOnceListener(event, listener);
    }

    public removeAllListeners(event?: Events | EventEmitterEvents): this {
        return super.removeAllListeners(event);
    }

    public removeListener(event: Events | EventEmitterEvents, listener: (...args: any[]) => void): this {
        return super.removeListener(event, listener);
    }

    public rawListeners(event: Events | EventEmitterEvents): Function[] {
        return super.rawListeners(event);
    }
}

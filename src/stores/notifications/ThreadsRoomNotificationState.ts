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

import { Room } from "matrix-js-sdk/src/models/room";
import { Thread, ThreadEvent } from "matrix-js-sdk/src/models/thread";

import { IDestroyable } from "../../utils/IDestroyable";
import { NotificationState, NotificationStateEvents } from "./NotificationState";
import { ThreadNotificationState } from "./ThreadNotificationState";
import { NotificationColor } from "./NotificationColor";

export class ThreadsRoomNotificationState extends NotificationState implements IDestroyable {
    public readonly threadsState = new Map<Thread, ThreadNotificationState>();

    protected _symbol = null;
    protected _count = 0;
    protected _color = NotificationColor.None;

    constructor(public readonly room: Room) {
        super();
        if (this.room?.threads) {
            for (const [, thread] of this.room.threads) {
                this.onNewThread(thread);
            }
        }
        this.room.on(ThreadEvent.New, this.onNewThread);
    }

    public destroy(): void {
        super.destroy();
        this.room.on(ThreadEvent.New, this.onNewThread);
        for (const [, notificationState] of this.threadsState) {
            notificationState.off(NotificationStateEvents.Update, this.onThreadUpdate);
        }
    }

    public getThreadRoomState(thread: Thread): ThreadNotificationState {
        if (!this.threadsState.has(thread)) {
            this.threadsState.set(thread, new ThreadNotificationState(thread));
        }
        return this.threadsState.get(thread);
    }

    private onNewThread = (thread: Thread): void => {
        const notificationState = new ThreadNotificationState(thread);
        this.threadsState.set(
            thread,
            notificationState,
        );
        notificationState.on(NotificationStateEvents.Update, this.onThreadUpdate);
    };

    private onThreadUpdate = (): void => {
        let color = NotificationColor.None;
        for (const [, notificationState] of this.threadsState) {
            if (notificationState.color === NotificationColor.Red) {
                color = NotificationColor.Red;
                break;
            } else if (notificationState.color === NotificationColor.Grey) {
                color = NotificationColor.Grey;
            }
        }
        this.updateNotificationState(color);
    };

    private updateNotificationState(color: NotificationColor): void {
        const snapshot = this.snapshot();
        this._color = color;
        // finally, publish an update if needed
        this.emitIfUpdated(snapshot);
    }
}

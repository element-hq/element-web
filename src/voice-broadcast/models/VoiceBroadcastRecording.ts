/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { MatrixClient, MatrixEvent, RelationType } from "matrix-js-sdk/src/matrix";
import { TypedEventEmitter } from "matrix-js-sdk/src/models/typed-event-emitter";

import { VoiceBroadcastInfoEventType, VoiceBroadcastInfoState } from "..";

export enum VoiceBroadcastRecordingEvent {
    StateChanged = "liveness_changed",
}

interface EventMap {
    [VoiceBroadcastRecordingEvent.StateChanged]: (state: VoiceBroadcastInfoState) => void;
}

export class VoiceBroadcastRecording extends TypedEventEmitter<VoiceBroadcastRecordingEvent, EventMap> {
    private _state: VoiceBroadcastInfoState;

    public constructor(
        public readonly infoEvent: MatrixEvent,
        private client: MatrixClient,
    ) {
        super();

        const room = this.client.getRoom(this.infoEvent.getRoomId());
        const relations = room?.getUnfilteredTimelineSet()?.relations?.getChildEventsForEvent(
            this.infoEvent.getId(),
            RelationType.Reference,
            VoiceBroadcastInfoEventType,
        );
        const relatedEvents = relations?.getRelations();
        this._state = !relatedEvents?.find((event: MatrixEvent) => {
            return event.getContent()?.state === VoiceBroadcastInfoState.Stopped;
        }) ? VoiceBroadcastInfoState.Started : VoiceBroadcastInfoState.Stopped;

        // TODO Michael W: add listening for updates
    }

    private setState(state: VoiceBroadcastInfoState): void {
        this._state = state;
        this.emit(VoiceBroadcastRecordingEvent.StateChanged, this.state);
    }

    public async stop() {
        this.setState(VoiceBroadcastInfoState.Stopped);
        // TODO Michael W: add error handling
        await this.client.sendStateEvent(
            this.infoEvent.getRoomId(),
            VoiceBroadcastInfoEventType,
            {
                state: VoiceBroadcastInfoState.Stopped,
                ["m.relates_to"]: {
                    rel_type: RelationType.Reference,
                    event_id: this.infoEvent.getId(),
                },
            },
            this.client.getUserId(),
        );
    }

    public get state(): VoiceBroadcastInfoState {
        return this._state;
    }
}

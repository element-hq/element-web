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

import { Room } from "matrix-js-sdk/src/models/room";
import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { RoomListStoreTempProxy } from "./room-list/RoomListStoreTempProxy";
import { textForEvent } from "../TextForEvent";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { _t } from "../languageHandler";

const PREVIEWABLE_EVENTS = [
    // This is the same list from RiotX
    {type: "m.room.message", isState: false},
    {type: "m.room.name", isState: true},
    {type: "m.room.topic", isState: true},
    {type: "m.room.member", isState: true},
    {type: "m.room.history_visibility", isState: true},
    {type: "m.call.invite", isState: false},
    {type: "m.call.hangup", isState: false},
    {type: "m.call.answer", isState: false},
    {type: "m.room.encrypted", isState: false},
    {type: "m.room.encryption", isState: true},
    {type: "m.room.third_party_invite", isState: true},
    {type: "m.sticker", isState: false},
    {type: "m.room.create", isState: true},
];

// The maximum number of events we're willing to look back on to get a preview.
const MAX_EVENTS_BACKWARDS = 50;

interface IState {
    [roomId: string]: string | null; // null indicates the preview is empty
}

export class MessagePreviewStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new MessagePreviewStore();

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): MessagePreviewStore {
        return MessagePreviewStore.internalInstance;
    }

    /**
     * Gets the pre-translated preview for a given room
     * @param room The room to get the preview for.
     * @returns The preview, or null if none present.
     */
    public getPreviewForRoom(room: Room): string {
        if (!room) return null; // invalid room, just return nothing

        // It's faster to do a lookup this way than it is to use Object.keys().includes()
        // We only want to generate a preview if there's one actually missing and not explicitly
        // set as 'none'.
        const val = this.state[room.roomId];
        if (val !== null && typeof(val) !== "string") {
            this.generatePreview(room);
        }

        return this.state[room.roomId];
    }

    private generatePreview(room: Room) {
        const events = room.timeline;
        if (!events) return; // should only happen in tests

        for (let i = events.length - 1; i >= 0; i--) {
            if (i === events.length - MAX_EVENTS_BACKWARDS) return; // limit reached

            const event = events[i];
            const preview = this.generatePreviewForEvent(event);
            if (preview.isPreviewable) {
                // noinspection JSIgnoredPromiseFromCall - the AsyncStore handles concurrent calls
                this.updateState({[room.roomId]: preview.preview});
                return; // break - we found some text
            }
        }

        // if we didn't find anything, subscribe ourselves to an update
        // noinspection JSIgnoredPromiseFromCall - the AsyncStore handles concurrent calls
        this.updateState({[room.roomId]: null});
    }

    protected async onAction(payload: ActionPayload) {
        if (!this.matrixClient) return;

        // TODO: Remove when new room list is made the default
        if (!RoomListStoreTempProxy.isUsingNewStore()) return;

        if (payload.action === 'MatrixActions.Room.timeline' || payload.action === 'MatrixActions.Event.decrypted') {
            const event = payload.event; // TODO: Type out the dispatcher
            if (!Object.keys(this.state).includes(event.getRoomId())) return; // not important

            const preview = this.generatePreviewForEvent(event);
            if (preview.isPreviewable) {
                await this.updateState({[event.getRoomId()]: preview.preview});
                return; // break - we found some text
            }
        }
    }

    private generatePreviewForEvent(event: MatrixEvent): { isPreviewable: boolean, preview: string } {
        if (PREVIEWABLE_EVENTS.some(p => p.type === event.getType() && p.isState === event.isState())) {
            const isSelf = event.getSender() === this.matrixClient.getUserId();
            let text = textForEvent(event, /*skipUserPrefix=*/isSelf);
            if (!text || text.trim().length === 0) text = null; // force null if useless to us
            if (text && isSelf) {
                // XXX: i18n doesn't really work here if the language doesn't support prefixing.
                // We'd ideally somehow route the `You:` bit to the textForEvent call, however
                // threading that through is non-trivial.
                text = _t("You: %(message)s", {message: text});
            }
            return {isPreviewable: true, preview: text};
        }
        return {isPreviewable: false, preview: null};
    }
}

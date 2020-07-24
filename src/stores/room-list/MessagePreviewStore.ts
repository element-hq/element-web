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
import { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { MessageEventPreview } from "./previews/MessageEventPreview";
import { TagID } from "./models";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { CallInviteEventPreview } from "./previews/CallInviteEventPreview";
import { CallAnswerEventPreview } from "./previews/CallAnswerEventPreview";
import { CallHangupEvent } from "./previews/CallHangupEvent";
import { StickerEventPreview } from "./previews/StickerEventPreview";
import { ReactionEventPreview } from "./previews/ReactionEventPreview";
import { UPDATE_EVENT } from "../AsyncStore";

// Emitted event for when a room's preview has changed. First argument will the room for which
// the change happened.
export const ROOM_PREVIEW_CHANGED = "room_preview_changed";

const PREVIEWS = {
    'm.room.message': {
        isState: false,
        previewer: new MessageEventPreview(),
    },
    'm.call.invite': {
        isState: false,
        previewer: new CallInviteEventPreview(),
    },
    'm.call.answer': {
        isState: false,
        previewer: new CallAnswerEventPreview(),
    },
    'm.call.hangup': {
        isState: false,
        previewer: new CallHangupEvent(),
    },
    'm.sticker': {
        isState: false,
        previewer: new StickerEventPreview(),
    },
    'm.reaction': {
        isState: false,
        previewer: new ReactionEventPreview(),
    },
};

// The maximum number of events we're willing to look back on to get a preview.
const MAX_EVENTS_BACKWARDS = 50;

// type merging ftw
type TAG_ANY = "im.vector.any";
const TAG_ANY: TAG_ANY = "im.vector.any";

interface IState {
    // Empty because we don't actually use the state
}

export class MessagePreviewStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new MessagePreviewStore();

    // null indicates the preview is empty / irrelevant
    private previews = new Map<string, Map<TagID|TAG_ANY, string|null>>();

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): MessagePreviewStore {
        return MessagePreviewStore.internalInstance;
    }

    /**
     * Gets the pre-translated preview for a given room
     * @param room The room to get the preview for.
     * @param inTagId The tag ID in which the room resides
     * @returns The preview, or null if none present.
     */
    public getPreviewForRoom(room: Room, inTagId: TagID): string {
        if (!room) return null; // invalid room, just return nothing

        if (!this.previews.has(room.roomId)) this.generatePreview(room, inTagId);

        const previews = this.previews.get(room.roomId);
        if (!previews) return null;

        if (!previews.has(inTagId)) {
            return previews.get(TAG_ANY);
        }
        return previews.get(inTagId);
    }

    private generatePreview(room: Room, tagId?: TagID) {
        const events = room.timeline;
        if (!events) return; // should only happen in tests

        let map = this.previews.get(room.roomId);
        if (!map) {
            map = new Map<TagID | TAG_ANY, string | null>();
            this.previews.set(room.roomId, map);
        }

        // Set the tags so we know what to generate
        if (!map.has(TAG_ANY)) map.set(TAG_ANY, null);
        if (tagId && !map.has(tagId)) map.set(tagId, null);

        let changed = false;
        for (let i = events.length - 1; i >= 0; i--) {
            if (i === events.length - MAX_EVENTS_BACKWARDS) return; // limit reached

            const event = events[i];
            const previewDef = PREVIEWS[event.getType()];
            if (!previewDef) continue;
            if (previewDef.isState && isNullOrUndefined(event.getStateKey())) continue;

            const anyPreview = previewDef.previewer.getTextFor(event, null);
            if (!anyPreview) continue; // not previewable for some reason

            changed = changed || anyPreview !== map.get(TAG_ANY);
            map.set(TAG_ANY, anyPreview);

            const tagsToGenerate = Array.from(map.keys()).filter(t => t !== TAG_ANY); // we did the any tag above
            for (const genTagId of tagsToGenerate) {
                const realTagId: TagID = genTagId === TAG_ANY ? null : genTagId;
                const preview = previewDef.previewer.getTextFor(event, realTagId);
                if (preview === anyPreview) {
                    changed = changed || anyPreview !== map.get(genTagId);
                    map.delete(genTagId);
                } else {
                    changed = changed || preview !== map.get(genTagId);
                    map.set(genTagId, preview);
                }
            }

            if (changed) {
                // We've muted the underlying Map, so just emit that we've changed.
                this.previews.set(room.roomId, map);
                this.emit(UPDATE_EVENT, this);
                this.emit(ROOM_PREVIEW_CHANGED, room);
            }
            return; // we're done
        }

        // At this point, we didn't generate a preview so clear it
        this.previews.set(room.roomId, new Map<TagID|TAG_ANY, string|null>());
        this.emit(UPDATE_EVENT, this);
        this.emit(ROOM_PREVIEW_CHANGED, room);
    }

    protected async onAction(payload: ActionPayload) {
        if (!this.matrixClient) return;

        if (payload.action === 'MatrixActions.Room.timeline' || payload.action === 'MatrixActions.Event.decrypted') {
            const event = payload.event; // TODO: Type out the dispatcher
            if (!this.previews.has(event.getRoomId())) return; // not important
            this.generatePreview(this.matrixClient.getRoom(event.getRoomId()), TAG_ANY);
        }
    }
}

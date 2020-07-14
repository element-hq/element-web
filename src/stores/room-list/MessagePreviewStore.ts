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
import { RoomListStoreTempProxy } from "./RoomListStoreTempProxy";
import { MessageEventPreview } from "./previews/MessageEventPreview";
import { NameEventPreview } from "./previews/NameEventPreview";
import { TagID } from "./models";
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { TopicEventPreview } from "./previews/TopicEventPreview";
import { MembershipEventPreview } from "./previews/MembershipEventPreview";
import { HistoryVisibilityEventPreview } from "./previews/HistoryVisibilityEventPreview";
import { CallInviteEventPreview } from "./previews/CallInviteEventPreview";
import { CallAnswerEventPreview } from "./previews/CallAnswerEventPreview";
import { CallHangupEvent } from "./previews/CallHangupEvent";
import { EncryptionEventPreview } from "./previews/EncryptionEventPreview";
import { ThirdPartyInviteEventPreview } from "./previews/ThirdPartyInviteEventPreview";
import { StickerEventPreview } from "./previews/StickerEventPreview";
import { ReactionEventPreview } from "./previews/ReactionEventPreview";
import { CreationEventPreview } from "./previews/CreationEventPreview";

const PREVIEWS = {
    'm.room.message': {
        isState: false,
        previewer: new MessageEventPreview(),
    },
    'm.room.name': {
        isState: true,
        previewer: new NameEventPreview(),
    },
    'm.room.topic': {
        isState: true,
        previewer: new TopicEventPreview(),
    },
    'm.room.member': {
        isState: true,
        previewer: new MembershipEventPreview(),
    },
    'm.room.history_visibility': {
        isState: true,
        previewer: new HistoryVisibilityEventPreview(),
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
    'm.room.encryption': {
        isState: true,
        previewer: new EncryptionEventPreview(),
    },
    'm.room.third_party_invite': {
        isState: true,
        previewer: new ThirdPartyInviteEventPreview(),
    },
    'm.sticker': {
        isState: false,
        previewer: new StickerEventPreview(),
    },
    'm.reaction': {
        isState: false,
        previewer: new ReactionEventPreview(),
    },
    'm.room.create': {
        isState: true,
        previewer: new CreationEventPreview(),
    },
};

// The maximum number of events we're willing to look back on to get a preview.
const MAX_EVENTS_BACKWARDS = 50;

// type merging ftw
type TAG_ANY = "im.vector.any";
const TAG_ANY: TAG_ANY = "im.vector.any";

interface IState {
    [roomId: string]: Map<TagID | TAG_ANY, string | null>; // null indicates the preview is empty / irrelevant
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
     * @param inTagId The tag ID in which the room resides
     * @returns The preview, or null if none present.
     */
    public getPreviewForRoom(room: Room, inTagId: TagID): string {
        if (!room) return null; // invalid room, just return nothing

        const val = this.state[room.roomId];
        if (!val) this.generatePreview(room, inTagId);

        const previews = this.state[room.roomId];
        if (!previews) return null;

        if (!previews.has(inTagId)) {
            return previews.get(TAG_ANY);
        }
        return previews.get(inTagId);
    }

    private generatePreview(room: Room, tagId?: TagID) {
        const events = room.timeline;
        if (!events) return; // should only happen in tests

        let map = this.state[room.roomId];
        if (!map) {
            map = new Map<TagID | TAG_ANY, string | null>();

            // We set the state later with the map, so no need to send an update now
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
                // Update state for good measure - causes emit for update
                // noinspection JSIgnoredPromiseFromCall - the AsyncStore handles concurrent calls
                this.updateState({[room.roomId]: map});
            }
            return; // we're done
        }

        // At this point, we didn't generate a preview so clear it
        // noinspection JSIgnoredPromiseFromCall - the AsyncStore handles concurrent calls
        this.updateState({[room.roomId]: null});
    }

    protected async onAction(payload: ActionPayload) {
        if (!this.matrixClient) return;

        // TODO: Remove when new room list is made the default: https://github.com/vector-im/riot-web/issues/14367
        if (!RoomListStoreTempProxy.isUsingNewStore()) return;

        if (payload.action === 'MatrixActions.Room.timeline' || payload.action === 'MatrixActions.Event.decrypted') {
            const event = payload.event; // TODO: Type out the dispatcher
            if (!Object.keys(this.state).includes(event.getRoomId())) return; // not important
            this.generatePreview(this.matrixClient.getRoom(event.getRoomId()), TAG_ANY);
        }
    }
}

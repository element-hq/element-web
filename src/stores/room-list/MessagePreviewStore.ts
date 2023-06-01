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
import { isNullOrUndefined } from "matrix-js-sdk/src/utils";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { M_POLL_START } from "matrix-js-sdk/src/@types/polls";
import { Thread } from "matrix-js-sdk/src/models/thread";
import { RelationType } from "matrix-js-sdk/src/matrix";

import { ActionPayload } from "../../dispatcher/payloads";
import { AsyncStoreWithClient } from "../AsyncStoreWithClient";
import defaultDispatcher from "../../dispatcher/dispatcher";
import { MessageEventPreview } from "./previews/MessageEventPreview";
import { PollStartEventPreview } from "./previews/PollStartEventPreview";
import { TagID } from "./models";
import { LegacyCallInviteEventPreview } from "./previews/LegacyCallInviteEventPreview";
import { LegacyCallAnswerEventPreview } from "./previews/LegacyCallAnswerEventPreview";
import { LegacyCallHangupEvent } from "./previews/LegacyCallHangupEvent";
import { StickerEventPreview } from "./previews/StickerEventPreview";
import { ReactionEventPreview } from "./previews/ReactionEventPreview";
import { UPDATE_EVENT } from "../AsyncStore";
import { IPreview } from "./previews/IPreview";
import { VoiceBroadcastInfoEventType } from "../../voice-broadcast";
import { VoiceBroadcastPreview } from "./previews/VoiceBroadcastPreview";

// Emitted event for when a room's preview has changed. First argument will the room for which
// the change happened.
const ROOM_PREVIEW_CHANGED = "room_preview_changed";

const PREVIEWS: Record<
    string,
    {
        isState: boolean;
        previewer: IPreview;
    }
> = {
    "m.room.message": {
        isState: false,
        previewer: new MessageEventPreview(),
    },
    "m.call.invite": {
        isState: false,
        previewer: new LegacyCallInviteEventPreview(),
    },
    "m.call.answer": {
        isState: false,
        previewer: new LegacyCallAnswerEventPreview(),
    },
    "m.call.hangup": {
        isState: false,
        previewer: new LegacyCallHangupEvent(),
    },
    "m.sticker": {
        isState: false,
        previewer: new StickerEventPreview(),
    },
    "m.reaction": {
        isState: false,
        previewer: new ReactionEventPreview(),
    },
    [M_POLL_START.name]: {
        isState: false,
        previewer: new PollStartEventPreview(),
    },
    [M_POLL_START.altName]: {
        isState: false,
        previewer: new PollStartEventPreview(),
    },
    [VoiceBroadcastInfoEventType]: {
        isState: true,
        previewer: new VoiceBroadcastPreview(),
    },
};

// The maximum number of events we're willing to look back on to get a preview.
const MAX_EVENTS_BACKWARDS = 50;

// type merging ftw
type TAG_ANY = "im.vector.any"; // eslint-disable-line @typescript-eslint/naming-convention
const TAG_ANY: TAG_ANY = "im.vector.any";

interface IState {
    // Empty because we don't actually use the state
}

export interface MessagePreview {
    event: MatrixEvent;
    isThreadReply: boolean;
    text: string;
}

const isThreadReply = (event: MatrixEvent): boolean => {
    // a thread root event cannot be a thread reply
    if (event.isThreadRoot) return false;

    const thread = event.getThread();

    // it cannot be a thread reply if there is no thread
    if (!thread) return false;

    const relation = event.getRelation();

    if (
        !!relation &&
        relation.rel_type === RelationType.Annotation &&
        relation.event_id === thread.rootEvent?.getId()
    ) {
        // annotations on the thread root are not a thread reply
        return false;
    }

    return true;
};

const mkMessagePreview = (text: string, event: MatrixEvent): MessagePreview => {
    return {
        event,
        text,
        isThreadReply: isThreadReply(event),
    };
};

export class MessagePreviewStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new MessagePreviewStore();
        instance.start();
        return instance;
    })();

    /**
     * @internal Public for test only
     */
    public static testInstance(): MessagePreviewStore {
        return new MessagePreviewStore();
    }

    // null indicates the preview is empty / irrelevant
    private previews = new Map<string, Map<TagID | TAG_ANY, MessagePreview | null>>();

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): MessagePreviewStore {
        return MessagePreviewStore.internalInstance;
    }

    public static getPreviewChangedEventName(room: Room): string {
        return `${ROOM_PREVIEW_CHANGED}:${room?.roomId}`;
    }

    /**
     * Gets the pre-translated preview for a given room
     * @param room The room to get the preview for.
     * @param inTagId The tag ID in which the room resides
     * @returns The preview, or null if none present.
     */
    public async getPreviewForRoom(room: Room, inTagId: TagID): Promise<MessagePreview | null> {
        if (!room) return null; // invalid room, just return nothing

        if (!this.previews.has(room.roomId)) await this.generatePreview(room, inTagId);

        const previews = this.previews.get(room.roomId);
        if (!previews) return null;

        if (previews.has(inTagId)) {
            return previews.get(inTagId)!;
        }
        return previews.get(TAG_ANY) ?? null;
    }

    public generatePreviewForEvent(event: MatrixEvent): string {
        const previewDef = PREVIEWS[event.getType()];
        return previewDef?.previewer.getTextFor(event, undefined, true) ?? "";
    }

    private shouldSkipPreview(event: MatrixEvent, previousEvent?: MatrixEvent): boolean {
        if (event.isRelation(RelationType.Replace)) {
            if (previousEvent !== undefined) {
                // Ignore edits if they don't apply to the latest event in the room to keep the preview on the latest event
                const room = this.matrixClient?.getRoom(event.getRoomId()!);
                const relatedEvent = room?.findEventById(event.relationEventId!);
                if (relatedEvent !== previousEvent) {
                    return true;
                }
            }
        }

        return false;
    }

    private async generatePreview(room: Room, tagId?: TagID): Promise<void> {
        const events = [...room.getLiveTimeline().getEvents()];

        // add last reply from each thread
        room.getThreads().forEach((thread: Thread): void => {
            const lastReply = thread.lastReply();
            if (lastReply) events.push(lastReply);
        });

        // sort events from oldest to newest
        events.sort((a: MatrixEvent, b: MatrixEvent) => {
            return a.getTs() - b.getTs();
        });

        if (!events) return; // should only happen in tests

        let map = this.previews.get(room.roomId);
        if (!map) {
            map = new Map<TagID | TAG_ANY, MessagePreview | null>();
            this.previews.set(room.roomId, map);
        }

        const previousEventInAny = map.get(TAG_ANY)?.event;

        // Set the tags so we know what to generate
        if (!map.has(TAG_ANY)) map.set(TAG_ANY, null);
        if (tagId && !map.has(tagId)) map.set(tagId, null);

        let changed = false;
        for (let i = events.length - 1; i >= 0; i--) {
            if (i === events.length - MAX_EVENTS_BACKWARDS) {
                // limit reached - clear the preview by breaking out of the loop
                break;
            }

            const event = events[i];

            await this.matrixClient?.decryptEventIfNeeded(event);

            const previewDef = PREVIEWS[event.getType()];
            if (!previewDef) continue;
            if (previewDef.isState && isNullOrUndefined(event.getStateKey())) continue;

            const anyPreviewText = previewDef.previewer.getTextFor(event);
            if (!anyPreviewText) continue; // not previewable for some reason

            if (!this.shouldSkipPreview(event, previousEventInAny)) {
                changed = changed || anyPreviewText !== map.get(TAG_ANY)?.text;
                map.set(TAG_ANY, mkMessagePreview(anyPreviewText, event));
            }

            const tagsToGenerate = Array.from(map.keys()).filter((t) => t !== TAG_ANY); // we did the any tag above
            for (const genTagId of tagsToGenerate) {
                const previousEventInTag = map.get(genTagId)?.event;
                if (this.shouldSkipPreview(event, previousEventInTag)) continue;

                const realTagId = genTagId === TAG_ANY ? undefined : genTagId;
                const preview = previewDef.previewer.getTextFor(event, realTagId);

                if (preview === anyPreviewText) {
                    changed = changed || anyPreviewText !== map.get(genTagId)?.text;
                    map.delete(genTagId);
                } else {
                    changed = changed || preview !== map.get(genTagId)?.text;
                    map.set(genTagId, preview ? mkMessagePreview(anyPreviewText, event) : null);
                }
            }

            if (changed) {
                // We've muted the underlying Map, so just emit that we've changed.
                this.previews.set(room.roomId, map);
                this.emit(UPDATE_EVENT, this);
                this.emit(MessagePreviewStore.getPreviewChangedEventName(room), room);
            }
            return; // we're done
        }

        // At this point, we didn't generate a preview so clear it
        this.previews.set(room.roomId, new Map<TagID | TAG_ANY, MessagePreview | null>());
        this.emit(UPDATE_EVENT, this);
        this.emit(MessagePreviewStore.getPreviewChangedEventName(room), room);
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        if (!this.matrixClient) return;

        if (payload.action === "MatrixActions.Room.timeline" || payload.action === "MatrixActions.Event.decrypted") {
            const event = payload.event; // TODO: Type out the dispatcher
            const roomId = event.getRoomId();
            const isHistoricalEvent = payload.hasOwnProperty("isLiveEvent") && !payload.isLiveEvent;

            if (!roomId || !this.previews.has(roomId) || isHistoricalEvent) return;

            const room = this.matrixClient.getRoom(roomId);

            if (!room) return;

            await this.generatePreview(room, TAG_ANY);
        }
    }
}

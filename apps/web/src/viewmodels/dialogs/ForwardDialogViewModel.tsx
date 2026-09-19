/*
Copyright 2026 Element Creations Ltd.
Copyright 2024 New Vector Ltd.
Copyright 2021 Robin Townsend <robin@robin.town>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    type IContent,
    type MatrixEvent,
    type Room,
    EventType,
    type MatrixClient,
    ContentHelpers,
    type ILocationContent,
    LocationAssetType,
    M_TIMESTAMP,
    M_BEACON,
} from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import {
    BaseViewModel,
    type ForwardDialogRoom,
    type ForwardDialogViewActions,
    type ForwardDialogViewSnapshot,
    type ForwardSendState,
} from "@element-hq/web-shared-components";

import dis from "../../dispatcher/dispatcher";
import { Action } from "../../dispatcher/actions";
import { type ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import { sortRoomsByRecency } from "../../utils/room/sortRoomsByRecency";
import QueryMatcher from "../../autocomplete/QueryMatcher";
import { filterBoolean } from "../../utils/arrays";
import { isLocationEvent } from "../../utils/EventUtils";
import { isSelfLocation, locationEventGeoUri } from "../../utils/location";
import { attachMentions } from "../../utils/messages";
import { CommandPartCreator } from "../../editor/parts";
import SettingsStore from "../../settings/SettingsStore";
import { parseEvent } from "../../editor/deserialize";
import EditorModel from "../../editor/model";
import DecoratedRoomAvatar from "../../components/views/avatars/DecoratedRoomAvatar";
import { roomContextDetails } from "../../utils/i18n-helpers";

/** How many rooms to show before collapsing the rest behind an "and N others" tile. */
const DEFAULT_TRUNCATE_AT = 10;

/**
 * Transform content of a MatrixEvent before forwarding:
 * 1. Strip all relations.
 * 2. Convert location events into a static pin-drop location share,
 *    and remove description from self-location shares.
 * 3. Parse the event back into an EditorModel and recalculate mentions.
 *
 * @param event - The MatrixEvent to transform.
 * @param cli - The MatrixClient (used for recalculation of mentions).
 * @returns The transformed event type and content.
 */
export const transformEvent = (event: MatrixEvent, cli: MatrixClient): { type: string; content: IContent } => {
    const {
        "m.relates_to": _, // strip relations - in future we will attach a relation pointing at the original event
        // We're taking a shallow copy here to avoid https://github.com/vector-im/element-web/issues/10924
        ...content
    } = event.getContent();

    // beacon pulses get transformed into static locations on forward
    const type = M_BEACON.matches(event.getType()) ? EventType.RoomMessage : event.getType();

    // self location shares should have their description removed
    // and become 'pin' share type
    if (
        (isLocationEvent(event) && isSelfLocation(content as ILocationContent)) ||
        // beacon pulses get transformed into static locations on forward
        M_BEACON.matches(event.getType())
    ) {
        const timestamp = M_TIMESTAMP.findIn<number>(content as ILocationContent);
        const geoUri = locationEventGeoUri(event);
        return {
            type,
            content: {
                ...content,
                ...ContentHelpers.makeLocationContent(
                    undefined, // text
                    geoUri,
                    timestamp || Date.now(),
                    undefined, // description
                    LocationAssetType.Pin,
                ),
            },
        };
    }

    // Mentions can leak information about the context of the original message, so:
    // 1. Parse the event's message body back into an EditorModel, then
    // 2. Pass through attachMentions() to recalculate mentions.
    const room = cli.getRoom(event.getRoomId())!;
    const partCreator = new CommandPartCreator(room, cli);
    const parts = parseEvent(event, partCreator, {
        shouldEscape: SettingsStore.getValue("MessageComposerInput.useMarkdown"),
    });
    const model = new EditorModel(parts, partCreator); // Temporary EditorModel to pass through
    const userId = cli.getSafeUserId();
    attachMentions(userId, content, model, undefined);

    return { type, content };
};

export interface ForwardDialogViewModelProps {
    matrixClient: MatrixClient;
    /** The event to forward. */
    event: MatrixEvent;
    /** Called when the dialog should close, e.g. after jumping to a room. */
    onFinished(this: void): void;
}

/**
 * View model for the forward dialog: owns the list of candidate rooms, the search
 * filter, and the per-room progress of sending the forwarded message.
 */
export class ForwardDialogViewModel
    extends BaseViewModel<ForwardDialogViewSnapshot, ForwardDialogViewModelProps>
    implements ForwardDialogViewActions
{
    /** The event type that will be sent when forwarding. */
    public readonly type: string;
    /** The event content that will be sent when forwarding, with relations stripped and mentions recalculated. */
    public readonly content: IContent;

    private readonly allRooms: Room[];
    private query = "";
    private readonly sendStates = new Map<string, ForwardSendState>();

    public constructor(props: ForwardDialogViewModelProps) {
        super(props, { rooms: [], truncateAt: DEFAULT_TRUNCATE_AT });

        const cli = props.matrixClient;
        const { type, content } = transformEvent(props.event, cli);
        this.type = type;
        this.content = content;

        const msc3946DynamicRoomPredecessors = SettingsStore.getValue("feature_dynamic_room_predecessors");
        this.allRooms = sortRoomsByRecency(
            cli
                .getVisibleRooms(msc3946DynamicRoomPredecessors)
                .filter((room) => room.getMyMembership() === KnownMembership.Join && !room.isSpaceRoom()),
            cli.getSafeUserId(),
        );

        this.snapshot.merge({ rooms: this.toViewRooms(this.filteredRooms()) });
    }

    public search = (query: string): void => {
        this.query = query.toLowerCase();
        this.snapshot.merge({ rooms: this.toViewRooms(this.filteredRooms()) });
    };

    public send = async (roomId: string): Promise<void> => {
        this.setSendState(roomId, "sending");
        try {
            await this.props.matrixClient.sendEvent(roomId, this.type as any, this.content as any);
            this.setSendState(roomId, "sent");
        } catch {
            this.setSendState(roomId, "failed");
        }
    };

    public openRoom = (roomId: string, viaKeyboard: boolean): void => {
        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: roomId,
            metricsTrigger: "WebForwardShortcut",
            metricsViaKeyboard: viaKeyboard,
        });
        this.props.onFinished();
    };

    public showAllRooms = (): void => {
        this.snapshot.merge({ truncateAt: this.snapshot.current.rooms.length });
    };

    public renderRoomAvatar = (roomId: string, size: string): React.ReactNode => {
        const room = this.props.matrixClient.getRoom(roomId);
        if (!room) return null;
        return <DecoratedRoomAvatar room={room} size={size} />;
    };

    private setSendState(roomId: string, sendState: ForwardSendState): void {
        this.sendStates.set(roomId, sendState);
        this.snapshot.merge({
            rooms: this.snapshot.current.rooms.map((room) => (room.id === roomId ? { ...room, sendState } : room)),
        });
    }

    private filteredRooms(): Room[] {
        if (!this.query) return this.allRooms;
        return new QueryMatcher<Room>(this.allRooms, {
            keys: ["name"],
            funcs: [(r) => filterBoolean([r.getCanonicalAlias(), ...r.getAltAliases()])],
            shouldMatchWordsOnly: false,
        }).match(this.query);
    }

    private toViewRooms(rooms: Room[]): ForwardDialogRoom[] {
        return rooms.map((room) => ({
            id: room.roomId,
            name: room.name,
            description: roomContextDetails(room)?.details ?? "",
            canSend: room.maySendMessage(),
            sendState: this.sendStates.get(room.roomId) ?? "can_send",
        }));
    }
}

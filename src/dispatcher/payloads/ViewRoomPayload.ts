/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent } from "matrix-js-sdk/src/matrix";
import { type ViewRoom as ViewRoomEvent } from "@matrix-org/analytics-events/types/typescript/ViewRoom";

import { type ActionPayload } from "../payloads";
import { type Action } from "../actions";
import { type IOOBData, type IThreepidInvite } from "../../stores/ThreepidInviteStore";
import { type IOpts } from "../../createRoom";
import { type JoinRoomPayload } from "./JoinRoomPayload";
import { type AtLeastOne } from "../../@types/common";

export type FocusNextType = "composer" | "threadsPanel" | undefined;

/* eslint-disable camelcase */
interface BaseViewRoomPayload extends Pick<ActionPayload, "action"> {
    action: Action.ViewRoom;

    event_id?: string; // the event to ensure is in view if any
    highlighted?: boolean; // whether to highlight `event_id`
    scroll_into_view?: boolean; // whether to scroll `event_id` into view
    should_peek?: boolean; // whether we should peek the room if we are not yet joined
    joining?: boolean; // whether we have already sent a join request for this room
    via_servers?: string[]; // the list of servers to join via if no room_alias is provided
    context_switch?: boolean; // whether this view room was a consequence of switching spaces
    replyingToEvent?: MatrixEvent; // the event we are replying to in this room if any
    auto_join?: boolean; // whether to automatically join the room if we are not already
    threepid_invite?: IThreepidInvite; // details about any 3pid invite we have to this room
    justCreatedOpts?: IOpts; // if this is a newly created room then this is a reference to the creation opts
    oob_data?: IOOBData; // any out-of-band data about this room can be used to render some room details without peeking
    forceTimeline?: boolean; // Whether to override default behaviour to end up at a timeline
    show_room_tile?: boolean; // Whether to ensure that the room tile is visible in the room list
    clear_search?: boolean; // Whether to clear the room list search
    view_call?: boolean; // Whether to view the call or call lobby for the room
    skipLobby?: boolean; // Whether to skip the call lobby when showing the call (only supported for element calls)
    opts?: JoinRoomPayload["opts"];

    deferred_action?: ActionPayload; // Action to fire after MatrixChat handles this ViewRoom action

    // additional parameters for the purpose of metrics & instrumentation
    metricsTrigger: ViewRoomEvent["trigger"];
    metricsViaKeyboard?: ViewRoomEvent["viaKeyboard"];
}

export type ViewRoomPayload = BaseViewRoomPayload &
    AtLeastOne<{
        // either or both of room_id or room_alias must be specified
        // where possible, a room_id should be provided with a room_alias as it reduces
        // the number of API calls required.
        room_id?: string;
        room_alias?: string;
        focusNext: FocusNextType; // wat to focus after room switch. Defaults to 'composer' if undefined.
    }>;
/* eslint-enable camelcase */

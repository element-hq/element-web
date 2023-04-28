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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { ViewRoom as ViewRoomEvent } from "@matrix-org/analytics-events/types/typescript/ViewRoom";

import { ActionPayload } from "../payloads";
import { Action } from "../actions";
import { IOOBData, IThreepidInvite } from "../../stores/ThreepidInviteStore";
import { IOpts } from "../../createRoom";
import { JoinRoomPayload } from "./JoinRoomPayload";
import { AtLeastOne } from "../../@types/common";

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
    }>;
/* eslint-enable camelcase */

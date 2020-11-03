/*
 * Copyright 2020 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *         http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Capability, ISendEventDetails, WidgetDriver, WidgetEventCapability, WidgetType } from "matrix-widget-api";
import { iterableUnion } from "../../utils/iterables";
import { MatrixClientPeg } from "../../MatrixClientPeg";
import { arrayFastClone } from "../../utils/arrays";
import { ElementWidgetCapabilities } from "./ElementWidgetCapabilities";
import ActiveRoomObserver from "../../ActiveRoomObserver";

// TODO: Purge this from the universe

export class StopGapWidgetDriver extends WidgetDriver {
    constructor(private allowedCapabilities: Capability[], private forType: WidgetType) {
        super();
    }

    public async validateCapabilities(requested: Set<Capability>): Promise<Set<Capability>> {
        // TODO: All of this should be a capabilities prompt.
        // See https://github.com/vector-im/element-web/issues/13111

        // Note: None of this well-known widget permissions stuff is documented intentionally. We
        // do not want to encourage people relying on this, but need to be able to support it at
        // the moment.
        //
        // If you're a widget developer and seeing this message, please ask the Element team if
        // it is safe for you to use this permissions system before trying to use it - it might
        // not be here in the future.

        const wkPerms = (MatrixClientPeg.get().getClientWellKnown() || {})['io.element.widget_permissions'];
        const allowedCaps = arrayFastClone(this.allowedCapabilities);
        if (wkPerms) {
            if (Array.isArray(wkPerms["view_room_action"])) {
                if (wkPerms["view_room_action"].includes(this.forType)) {
                    allowedCaps.push(ElementWidgetCapabilities.CanChangeViewedRoom);
                }
            }
            if (Array.isArray(wkPerms["event_actions"])) {
                if (wkPerms["event_actions"].includes(this.forType)) {
                    allowedCaps.push(...WidgetEventCapability.findEventCapabilities(requested).map(c => c.raw));
                }
            }
        }
        return new Set(iterableUnion(requested, allowedCaps));
    }

    public async sendEvent(eventType: string, content: any, stateKey: string = null): Promise<ISendEventDetails> {
        const client = MatrixClientPeg.get();
        const roomId = ActiveRoomObserver.activeRoomId;

        if (!client || !roomId) throw new Error("Not in a room or not attached to a client");

        let r: {event_id: string} = null; // eslint-disable-line camelcase
        if (stateKey !== null) {
            // state event
            r = await client.sendStateEvent(roomId, eventType, content, stateKey);
        } else {
            // message event
            r = await client.sendEvent(roomId, eventType, content);
        }

        return {roomId, eventId: r.event_id};
    }
}

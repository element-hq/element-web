/*
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.

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

import React from "react";
import {Room} from "matrix-js-sdk/src/models/room";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";

import {_t} from "../../../../../languageHandler";
import {MatrixClientPeg} from "../../../../../MatrixClientPeg";
import BridgeTile from "../../BridgeTile";

const BRIDGE_EVENT_TYPES = [
    "uk.half-shot.bridge",
    // m.bridge
];

const BRIDGES_LINK = "https://matrix.org/bridges/";

interface IProps {
    roomId: string;
}

export default class BridgeSettingsTab extends React.Component<IProps> {
    private renderBridgeCard(event: MatrixEvent, room: Room) {
        const content = event.getContent();
        if (!content || !content.channel || !content.protocol) {
            return null;
        }
        return <BridgeTile key={event.getId()} room={room} ev={event} />;
    }

    static getBridgeStateEvents(roomId: string) {
        const client = MatrixClientPeg.get();
        const roomState = client.getRoom(roomId).currentState;

        return BRIDGE_EVENT_TYPES.map(typeName => {
            const events = roomState.events.get(typeName);
            return events ? Array.from(events.values()) : [];
        }).flat(1);
    }

    render() {
        // This settings tab will only be invoked if the following function returns more
        // than 0 events, so no validation is needed at this stage.
        const bridgeEvents = BridgeSettingsTab.getBridgeStateEvents(this.props.roomId);
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        let content: JSX.Element;
        if (bridgeEvents.length > 0) {
            content = <div>
                <p>{_t(
                    "This room is bridging messages to the following platforms. " +
                    "<a>Learn more.</a>", {},
                    {
                        // TODO: We don't have this link yet: this will prevent the translators
                        // having to re-translate the string when we do.
                        a: sub => <a href={BRIDGES_LINK} target="_blank" rel="noreferrer noopener">{sub}</a>,
                    },
                )}</p>
                <ul className="mx_RoomSettingsDialog_BridgeList">
                    { bridgeEvents.map((event) => this.renderBridgeCard(event, room)) }
                </ul>
            </div>;
        } else {
            content = <p>{_t(
                "This room isn’t bridging messages to any platforms. " +
                "<a>Learn more.</a>", {},
                {
                    // TODO: We don't have this link yet: this will prevent the translators
                    // having to re-translate the string when we do.
                    a: sub => <a href={BRIDGES_LINK} target="_blank" rel="noreferrer noopener">{sub}</a>,
                },
            )}</p>;
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{_t("Bridges")}</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    {content}
                </div>
            </div>
        );
    }
}

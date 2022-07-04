/*
 Copyright 2015, 2016 OpenMarket Ltd

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

import React from 'react';
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { MsgType } from "matrix-js-sdk/src/@types/event";

import MatrixClientContext from "../../../contexts/MatrixClientContext";
import DisambiguatedProfile from "./DisambiguatedProfile";
import RoomContext, { TimelineRenderingType } from '../../../contexts/RoomContext';
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    mxEvent: MatrixEvent;
    onClick?(): void;
}

export default class SenderProfile extends React.PureComponent<IProps> {
    public static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;

    render() {
        const { mxEvent, onClick } = this.props;
        const msgtype = mxEvent.getContent().msgtype;

        let member = mxEvent.sender;
        if (SettingsStore.getValue("useOnlyCurrentProfiles")) {
            const room = MatrixClientPeg.get().getRoom(mxEvent.getRoomId());
            if (room) {
                member = room.getMember(mxEvent.getSender());
            }
        }

        return <RoomContext.Consumer>
            { roomContext => {
                if (msgtype === MsgType.Emote &&
                    roomContext.timelineRenderingType !== TimelineRenderingType.ThreadsList
                ) {
                    return null; // emote message must include the name so don't duplicate it
                }

                return (
                    <DisambiguatedProfile
                        fallbackName={mxEvent.getSender() || ""}
                        onClick={onClick}
                        member={member}
                        colored={true}
                        emphasizeDisplayName={true}
                    />
                );
            } }
        </RoomContext.Consumer>;
    }
}

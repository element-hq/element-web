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
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";

import Flair from '../elements/Flair';
import FlairStore from '../../../stores/FlairStore';
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { replaceableComponent } from "../../../utils/replaceableComponent";
import DisambiguatedProfile from "./DisambiguatedProfile";
import RoomContext, { TimelineRenderingType } from '../../../contexts/RoomContext';
import SettingsStore from "../../../settings/SettingsStore";
import { MatrixClientPeg } from "../../../MatrixClientPeg";

interface IProps {
    mxEvent: MatrixEvent;
    onClick?(): void;
    enableFlair: boolean;
}

interface IState {
    userGroups: string[];
    relatedGroups: string[];
}

@replaceableComponent("views.messages.SenderProfile")
export default class SenderProfile extends React.Component<IProps, IState> {
    static contextType = MatrixClientContext;
    public context!: React.ContextType<typeof MatrixClientContext>;
    private unmounted = false;

    constructor(props: IProps) {
        super(props);
        const senderId = this.props.mxEvent.getSender();

        this.state = {
            userGroups: FlairStore.cachedPublicisedGroups(senderId) || [],
            relatedGroups: [],
        };
    }

    componentDidMount() {
        this.updateRelatedGroups();

        if (this.state.userGroups.length === 0) {
            this.getPublicisedGroups();
        }

        this.context.on(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    componentWillUnmount() {
        this.unmounted = true;
        this.context.removeListener(RoomStateEvent.Events, this.onRoomStateEvents);
    }

    private async getPublicisedGroups() {
        const userGroups = await FlairStore.getPublicisedGroupsCached(this.context, this.props.mxEvent.getSender());
        if (this.unmounted) return;
        this.setState({ userGroups });
    }

    private onRoomStateEvents = (event: MatrixEvent) => {
        if (event.getType() === 'm.room.related_groups' && event.getRoomId() === this.props.mxEvent.getRoomId()) {
            this.updateRelatedGroups();
        }
    };

    private updateRelatedGroups() {
        const room = this.context.getRoom(this.props.mxEvent.getRoomId());
        if (!room) return;

        const relatedGroupsEvent = room.currentState.getStateEvents('m.room.related_groups', '');
        this.setState({
            relatedGroups: relatedGroupsEvent?.getContent().groups || [],
        });
    }

    private getDisplayedGroups(userGroups?: string[], relatedGroups?: string[]) {
        let displayedGroups = userGroups || [];
        if (relatedGroups && relatedGroups.length > 0) {
            displayedGroups = relatedGroups.filter((groupId) => {
                return displayedGroups.includes(groupId);
            });
        } else {
            displayedGroups = [];
        }
        return displayedGroups;
    }

    render() {
        const { mxEvent, onClick } = this.props;
        const msgtype = mxEvent.getContent().msgtype;

        let member = mxEvent.sender;
        if (SettingsStore.getValue("feature_use_only_current_profiles")) {
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

                let flair;
                if (this.props.enableFlair) {
                    const displayedGroups = this.getDisplayedGroups(
                        this.state.userGroups, this.state.relatedGroups,
                    );

                    flair = <Flair key='flair' userId={mxEvent.getSender()} groups={displayedGroups} />;
                }

                return (
                    <DisambiguatedProfile
                        fallbackName={mxEvent.getSender() || ""}
                        flair={flair}
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

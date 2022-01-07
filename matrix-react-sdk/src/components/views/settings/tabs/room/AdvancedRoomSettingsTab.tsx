/*
Copyright 2019 - 2021 The Matrix.org Foundation C.I.C.

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
import { EventType } from 'matrix-js-sdk/src/@types/event';

import { _t } from "../../../../../languageHandler";
import { MatrixClientPeg } from "../../../../../MatrixClientPeg";
import AccessibleButton from "../../../elements/AccessibleButton";
import RoomUpgradeDialog from "../../../dialogs/RoomUpgradeDialog";
import DevtoolsDialog from "../../../dialogs/DevtoolsDialog";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from '../../../../../dispatcher/actions';
import { replaceableComponent } from "../../../../../utils/replaceableComponent";

interface IProps {
    roomId: string;
    closeSettingsFn(): void;
}

interface IRecommendedVersion {
    version: string;
    needsUpgrade: boolean;
    urgent: boolean;
}

interface IState {
    upgradeRecommendation?: IRecommendedVersion;
    oldRoomId?: string;
    oldEventId?: string;
    upgraded?: boolean;
}

@replaceableComponent("views.settings.tabs.room.AdvancedRoomSettingsTab")
export default class AdvancedRoomSettingsTab extends React.Component<IProps, IState> {
    constructor(props, context) {
        super(props, context);

        this.state = {
            // This is eventually set to the value of room.getRecommendedVersion()
            upgradeRecommendation: null,
        };

        // we handle lack of this object gracefully later, so don't worry about it failing here.
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        room.getRecommendedVersion().then((v) => {
            const tombstone = room.currentState.getStateEvents(EventType.RoomTombstone, "");

            const additionalStateChanges: Partial<IState> = {};
            const createEvent = room.currentState.getStateEvents(EventType.RoomCreate, "");
            const predecessor = createEvent ? createEvent.getContent().predecessor : null;
            if (predecessor && predecessor.room_id) {
                additionalStateChanges.oldRoomId = predecessor.room_id;
                additionalStateChanges.oldEventId = predecessor.event_id;
            }

            this.setState({
                upgraded: !!tombstone?.getContent().replacement_room,
                upgradeRecommendation: v,
                ...additionalStateChanges,
            });
        });
    }

    private upgradeRoom = (e) => {
        const room = MatrixClientPeg.get().getRoom(this.props.roomId);
        Modal.createTrackedDialog('Upgrade Room Version', '', RoomUpgradeDialog, { room });
    };

    private openDevtools = (e) => {
        Modal.createDialog(DevtoolsDialog, { roomId: this.props.roomId });
    };

    private onOldRoomClicked = (e) => {
        e.preventDefault();
        e.stopPropagation();

        dis.dispatch({
            action: Action.ViewRoom,
            room_id: this.state.oldRoomId,
            event_id: this.state.oldEventId,
        });
        this.props.closeSettingsFn();
    };

    render() {
        const client = MatrixClientPeg.get();
        const room = client.getRoom(this.props.roomId);

        let unfederatableSection;
        const createEvent = room.currentState.getStateEvents(EventType.RoomCreate, '');
        if (createEvent && createEvent.getContent()['m.federate'] === false) {
            unfederatableSection = <div>{ _t('This room is not accessible by remote Matrix servers') }</div>;
        }

        let roomUpgradeButton;
        if (this.state.upgradeRecommendation && this.state.upgradeRecommendation.needsUpgrade && !this.state.upgraded) {
            roomUpgradeButton = (
                <div>
                    <p className='mx_SettingsTab_warningText'>
                        { _t(
                            "<b>Warning</b>: Upgrading a room will <i>not automatically migrate room members " +
                            "to the new version of the room.</i> We'll post a link to the new room in the old " +
                            "version of the room - room members will have to click this link to join the new room.",
                            {}, {
                                "b": (sub) => <b>{ sub }</b>,
                                "i": (sub) => <i>{ sub }</i>,
                            },
                        ) }
                    </p>
                    <AccessibleButton onClick={this.upgradeRoom} kind='primary'>
                        { _t("Upgrade this room to the recommended room version") }
                    </AccessibleButton>
                </div>
            );
        }

        let oldRoomLink;
        if (this.state.oldRoomId) {
            let name = _t("this room");
            const room = MatrixClientPeg.get().getRoom(this.props.roomId);
            if (room && room.name) name = room.name;
            oldRoomLink = (
                <AccessibleButton element='a' onClick={this.onOldRoomClicked}>
                    { _t("View older messages in %(roomName)s.", { roomName: name }) }
                </AccessibleButton>
            );
        }

        return (
            <div className="mx_SettingsTab">
                <div className="mx_SettingsTab_heading">{ _t("Advanced") }</div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>
                        { room?.isSpaceRoom() ? _t("Space information") : _t("Room information") }
                    </span>
                    <div>
                        <span>{ _t("Internal room ID:") }</span>&nbsp;
                        { this.props.roomId }
                    </div>
                    { unfederatableSection }
                </div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{ _t("Room version") }</span>
                    <div>
                        <span>{ _t("Room version:") }</span>&nbsp;
                        { room.getVersion() }
                    </div>
                    { oldRoomLink }
                    { roomUpgradeButton }
                </div>
                <div className='mx_SettingsTab_section mx_SettingsTab_subsectionText'>
                    <span className='mx_SettingsTab_subheading'>{ _t("Developer options") }</span>
                    <AccessibleButton onClick={this.openDevtools} kind='primary'>
                        { _t("Open Devtools") }
                    </AccessibleButton>
                </div>
            </div>
        );
    }
}

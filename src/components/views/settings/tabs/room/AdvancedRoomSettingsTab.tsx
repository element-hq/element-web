/*
Copyright 2019 - 2022 The Matrix.org Foundation C.I.C.

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
import { EventType } from "matrix-js-sdk/src/@types/event";
import { Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import AccessibleButton, { ButtonEvent } from "../../../elements/AccessibleButton";
import RoomUpgradeDialog from "../../../dialogs/RoomUpgradeDialog";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import CopyableText from "../../../elements/CopyableText";
import { ViewRoomPayload } from "../../../../../dispatcher/payloads/ViewRoomPayload";
import SettingsStore from "../../../../../settings/SettingsStore";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import SettingsSubsection from "../../shared/SettingsSubsection";

interface IProps {
    room: Room;
    closeSettingsFn(): void;
}

interface IRecommendedVersion {
    version: string;
    needsUpgrade: boolean;
    urgent: boolean;
}

interface IState {
    // This is eventually set to the value of room.getRecommendedVersion()
    upgradeRecommendation?: IRecommendedVersion;

    /** The room ID of this room's predecessor, if it exists. */
    oldRoomId?: string;

    /** The ID of tombstone event in this room's predecessor, if it exists. */
    oldEventId?: string;

    /** The via servers to use to find this room's predecessor, if it exists. */
    oldViaServers?: string[];

    upgraded?: boolean;
}

export default class AdvancedRoomSettingsTab extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");

        this.state = {};

        // we handle lack of this object gracefully later, so don't worry about it failing here.
        const room = this.props.room;
        room.getRecommendedVersion().then((v) => {
            const tombstone = room.currentState.getStateEvents(EventType.RoomTombstone, "");

            const additionalStateChanges: Partial<IState> = {};
            const predecessor = room.findPredecessor(msc3946ProcessDynamicPredecessor);
            if (predecessor) {
                additionalStateChanges.oldRoomId = predecessor.roomId;
                additionalStateChanges.oldEventId = predecessor.eventId;
                additionalStateChanges.oldViaServers = predecessor.viaServers;
            }

            this.setState({
                upgraded: !!tombstone?.getContent().replacement_room,
                upgradeRecommendation: v,
                ...additionalStateChanges,
            });
        });
    }

    private upgradeRoom = (): void => {
        Modal.createDialog(RoomUpgradeDialog, { room: this.props.room });
    };

    private onOldRoomClicked = (e: ButtonEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        dis.dispatch<ViewRoomPayload>({
            action: Action.ViewRoom,
            room_id: this.state.oldRoomId,
            event_id: this.state.oldEventId,
            via_servers: this.state.oldViaServers,
            metricsTrigger: "WebPredecessorSettings",
            metricsViaKeyboard: e.type !== "click",
        });
        this.props.closeSettingsFn();
    };

    public render(): React.ReactNode {
        const room = this.props.room;
        const isSpace = room.isSpaceRoom();

        let unfederatableSection: JSX.Element | undefined;
        if (room.currentState.getStateEvents(EventType.RoomCreate, "")?.getContent()["m.federate"] === false) {
            unfederatableSection = <div>{_t("This room is not accessible by remote Matrix servers")}</div>;
        }

        let roomUpgradeButton;
        if (this.state.upgradeRecommendation && this.state.upgradeRecommendation.needsUpgrade && !this.state.upgraded) {
            roomUpgradeButton = (
                <div>
                    <p className="mx_SettingsTab_warningText">
                        {_t(
                            "<b>Warning</b>: upgrading a room will <i>not automatically migrate room members " +
                                "to the new version of the room.</i> We'll post a link to the new room in the old " +
                                "version of the room - room members will have to click this link to join the new room.",
                            {},
                            {
                                b: (sub) => <b>{sub}</b>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                    <AccessibleButton onClick={this.upgradeRoom} kind="primary">
                        {isSpace
                            ? _t("Upgrade this space to the recommended room version")
                            : _t("Upgrade this room to the recommended room version")}
                    </AccessibleButton>
                </div>
            );
        }

        let oldRoomLink: JSX.Element | undefined;
        if (this.state.oldRoomId) {
            let copy: string;
            if (isSpace) {
                copy = _t("View older version of %(spaceName)s.", { spaceName: room.name ?? this.state.oldRoomId });
            } else {
                copy = _t("View older messages in %(roomName)s.", { roomName: room.name ?? this.state.oldRoomId });
            }

            oldRoomLink = (
                <AccessibleButton element="a" onClick={this.onOldRoomClicked}>
                    {copy}
                </AccessibleButton>
            );
        }

        return (
            <SettingsTab>
                <SettingsSection heading={_t("Advanced")}>
                    <SettingsSubsection heading={room.isSpaceRoom() ? _t("Space information") : _t("Room information")}>
                        <div>
                            <span>{_t("Internal room ID")}</span>
                            <CopyableText getTextToCopy={() => this.props.room.roomId}>
                                {this.props.room.roomId}
                            </CopyableText>
                        </div>
                        {unfederatableSection}
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("Room version")}>
                        <div>
                            <span>{_t("Room version:")}</span>&nbsp;
                            {room.getVersion()}
                        </div>
                        {oldRoomLink}
                        {roomUpgradeButton}
                    </SettingsSubsection>
                </SettingsSection>
            </SettingsTab>
        );
    }
}

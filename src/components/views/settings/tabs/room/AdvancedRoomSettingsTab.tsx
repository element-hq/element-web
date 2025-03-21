/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type JSX } from "react";
import { EventType, type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../../../elements/AccessibleButton";
import RoomUpgradeDialog from "../../../dialogs/RoomUpgradeDialog";
import Modal from "../../../../../Modal";
import dis from "../../../../../dispatcher/dispatcher";
import { Action } from "../../../../../dispatcher/actions";
import CopyableText from "../../../elements/CopyableText";
import { type ViewRoomPayload } from "../../../../../dispatcher/payloads/ViewRoomPayload";
import SettingsStore from "../../../../../settings/SettingsStore";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { SettingsSubsection } from "../../shared/SettingsSubsection";

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

        this.state = {};
    }

    public componentDidMount(): void {
        const msc3946ProcessDynamicPredecessor = SettingsStore.getValue("feature_dynamic_room_predecessors");

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
            unfederatableSection = <div>{_t("room_settings|advanced|unfederated")}</div>;
        }

        let roomUpgradeButton;
        if (this.state.upgradeRecommendation && this.state.upgradeRecommendation.needsUpgrade && !this.state.upgraded) {
            roomUpgradeButton = (
                <div>
                    <p className="mx_SettingsTab_warningText">
                        {_t(
                            "room_settings|advanced|room_upgrade_warning",
                            {},
                            {
                                b: (sub) => <strong>{sub}</strong>,
                                i: (sub) => <i>{sub}</i>,
                            },
                        )}
                    </p>
                    <AccessibleButton onClick={this.upgradeRoom} kind="primary">
                        {isSpace
                            ? _t("room_settings|advanced|space_upgrade_button")
                            : _t("room_settings|advanced|room_upgrade_button")}
                    </AccessibleButton>
                </div>
            );
        }

        let oldRoomLink: JSX.Element | undefined;
        if (this.state.oldRoomId) {
            let copy: string;
            if (isSpace) {
                copy = _t("room_settings|advanced|space_predecessor", { spaceName: room.name ?? this.state.oldRoomId });
            } else {
                copy = _t("room_settings|advanced|room_predecessor", { roomName: room.name ?? this.state.oldRoomId });
            }

            oldRoomLink = (
                <AccessibleButton element="a" onClick={this.onOldRoomClicked}>
                    {copy}
                </AccessibleButton>
            );
        }

        return (
            <SettingsTab>
                <SettingsSection heading={_t("common|advanced")}>
                    <SettingsSubsection
                        heading={
                            room.isSpaceRoom()
                                ? _t("room_settings|advanced|information_section_space")
                                : _t("room_settings|advanced|information_section_room")
                        }
                    >
                        <div>
                            <span>{_t("room_settings|advanced|room_id")}</span>
                            <CopyableText getTextToCopy={() => this.props.room.roomId}>
                                {this.props.room.roomId}
                            </CopyableText>
                        </div>
                        {unfederatableSection}
                    </SettingsSubsection>
                    <SettingsSubsection heading={_t("room_settings|advanced|room_version_section")}>
                        <div>
                            <span>{_t("room_settings|advanced|room_version")}</span>&nbsp;
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

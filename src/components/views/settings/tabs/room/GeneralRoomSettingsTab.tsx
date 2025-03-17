/*
Copyright 2019-2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ContextType } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import { _t } from "../../../../../languageHandler";
import RoomProfileSettings from "../../../room_settings/RoomProfileSettings";
import AccessibleButton, { type ButtonEvent } from "../../../elements/AccessibleButton";
import dis from "../../../../../dispatcher/dispatcher";
import MatrixClientContext from "../../../../../contexts/MatrixClientContext";
import SettingsStore from "../../../../../settings/SettingsStore";
import { UIFeature } from "../../../../../settings/UIFeature";
import AliasSettings from "../../../room_settings/AliasSettings";
import PosthogTrackers from "../../../../../PosthogTrackers";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import { SettingsSection } from "../../shared/SettingsSection";
import { UrlPreviewSettings } from "../../../room_settings/UrlPreviewSettings";

interface IProps {
    room: Room;
}

interface IState {
    isRoomPublished: boolean;
}

export default class GeneralRoomSettingsTab extends React.Component<IProps, IState> {
    public static contextType = MatrixClientContext;
    declare public context: ContextType<typeof MatrixClientContext>;

    public constructor(props: IProps, context: ContextType<typeof MatrixClientContext>) {
        super(props, context);

        this.state = {
            isRoomPublished: false, // loaded async
        };
    }

    private onLeaveClick = (ev: ButtonEvent): void => {
        dis.dispatch({
            action: "leave_room",
            room_id: this.props.room.roomId,
        });

        PosthogTrackers.trackInteraction("WebRoomSettingsLeaveButton", ev);
    };

    public render(): React.ReactNode {
        const client = this.context;
        const room = this.props.room;

        const canSetAliases = true; // Previously, we arbitrarily only allowed admins to do this
        const canSetCanonical = room.currentState.mayClientSendStateEvent("m.room.canonical_alias", client);
        const canonicalAliasEv = room.currentState.getStateEvents("m.room.canonical_alias", "") ?? undefined;

        const urlPreviewSettings = SettingsStore.getValue(UIFeature.URLPreviews) ? (
            <UrlPreviewSettings room={room} />
        ) : null;

        let leaveSection;
        if (room.getMyMembership() === KnownMembership.Join) {
            leaveSection = (
                <SettingsSubsection heading={_t("action|leave_room")}>
                    <AccessibleButton kind="danger" onClick={this.onLeaveClick}>
                        {_t("action|leave_room")}
                    </AccessibleButton>
                </SettingsSubsection>
            );
        }

        return (
            <SettingsTab data-testid="General">
                <SettingsSection heading={_t("common|general")}>
                    <RoomProfileSettings roomId={room.roomId} />
                </SettingsSection>

                <SettingsSection heading={_t("room_settings|general|aliases_section")}>
                    <AliasSettings
                        roomId={room.roomId}
                        canSetCanonicalAlias={canSetCanonical}
                        canSetAliases={canSetAliases}
                        canonicalAliasEvent={canonicalAliasEv}
                    />
                </SettingsSection>

                <SettingsSection heading={_t("room_settings|general|other_section")}>
                    {urlPreviewSettings}
                    {leaveSection}
                </SettingsSection>
            </SettingsTab>
        );
    }
}

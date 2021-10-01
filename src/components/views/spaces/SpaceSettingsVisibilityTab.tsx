/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState } from "react";
import { Room } from "matrix-js-sdk/src/models/room";
import { MatrixClient } from "matrix-js-sdk/src/client";
import { EventType } from "matrix-js-sdk/src/@types/event";
import { GuestAccess, HistoryVisibility, JoinRule } from "matrix-js-sdk/src/@types/partials";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import AliasSettings from "../room_settings/AliasSettings";
import { useStateToggle } from "../../../hooks/useStateToggle";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { useLocalEcho } from "../../../hooks/useLocalEcho";
import JoinRuleSettings from "../settings/JoinRuleSettings";
import { useRoomState } from "../../../hooks/useRoomState";

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
    closeSettingsFn(): void;
}

const SpaceSettingsVisibilityTab = ({ matrixClient: cli, space, closeSettingsFn }: IProps) => {
    const [error, setError] = useState("");

    const userId = cli.getUserId();

    const joinRule = useRoomState(space, state => state.getJoinRule());
    const [guestAccessEnabled, setGuestAccessEnabled] = useLocalEcho<boolean>(
        () => space.currentState.getStateEvents(EventType.RoomGuestAccess, "")
            ?.getContent()?.guest_access === GuestAccess.CanJoin,
        guestAccessEnabled => cli.sendStateEvent(space.roomId, EventType.RoomGuestAccess, {
            guest_access: guestAccessEnabled ? GuestAccess.CanJoin : GuestAccess.Forbidden,
        }, ""),
        () => setError(_t("Failed to update the guest access of this space")),
    );
    const [historyVisibility, setHistoryVisibility] = useLocalEcho<HistoryVisibility>(
        () => space.currentState.getStateEvents(EventType.RoomHistoryVisibility, "")
            ?.getContent()?.history_visibility || HistoryVisibility.Shared,
        historyVisibility => cli.sendStateEvent(space.roomId, EventType.RoomHistoryVisibility, {
            history_visibility: historyVisibility,
        }, ""),
        () => setError(_t("Failed to update the history visibility of this space")),
    );

    const [showAdvancedSection, toggleAdvancedSection] = useStateToggle();

    const canSetGuestAccess = space.currentState.maySendStateEvent(EventType.RoomGuestAccess, userId);
    const canSetHistoryVisibility = space.currentState.maySendStateEvent(EventType.RoomHistoryVisibility, userId);
    const canSetCanonical = space.currentState.mayClientSendStateEvent(EventType.RoomCanonicalAlias, cli);
    const canonicalAliasEv = space.currentState.getStateEvents(EventType.RoomCanonicalAlias, "");

    let advancedSection;
    if (joinRule === JoinRule.Public) {
        if (showAdvancedSection) {
            advancedSection = <>
                <AccessibleButton onClick={toggleAdvancedSection} kind="link" className="mx_SettingsTab_showAdvanced">
                    { _t("Hide advanced") }
                </AccessibleButton>

                <LabelledToggleSwitch
                    value={guestAccessEnabled}
                    onChange={setGuestAccessEnabled}
                    disabled={!canSetGuestAccess}
                    label={_t("Enable guest access")}
                />
                <p>
                    { _t("Guests can join a space without having an account.") }
                    <br />
                    { _t("This may be useful for public spaces.") }
                </p>
            </>;
        } else {
            advancedSection = <>
                <AccessibleButton onClick={toggleAdvancedSection} kind="link" className="mx_SettingsTab_showAdvanced">
                    { _t("Show advanced") }
                </AccessibleButton>
            </>;
        }
    }

    let addressesSection;
    if (space.getJoinRule() === JoinRule.Public) {
        addressesSection = <>
            <span className="mx_SettingsTab_subheading">{ _t("Address") }</span>
            <div className="mx_SettingsTab_section mx_SettingsTab_subsectionText">
                <AliasSettings
                    roomId={space.roomId}
                    canSetCanonicalAlias={canSetCanonical}
                    canSetAliases={true}
                    canonicalAliasEvent={canonicalAliasEv}
                    hidePublishSetting={true}
                />
            </div>
        </>;
    }

    return <div className="mx_SettingsTab">
        <div className="mx_SettingsTab_heading">{ _t("Visibility") }</div>

        { error && <div className="mx_SpaceRoomView_errorText">{ error }</div> }

        <div className="mx_SettingsTab_section">
            <div className="mx_SettingsTab_section_caption">
                { _t("Decide who can view and join %(spaceName)s.", { spaceName: space.name }) }
            </div>

            <div>
                <JoinRuleSettings
                    room={space}
                    onError={() => setError(_t("Failed to update the visibility of this space"))}
                    closeSettingsFn={closeSettingsFn}
                />
            </div>

            { advancedSection }

            <LabelledToggleSwitch
                value={historyVisibility === HistoryVisibility.WorldReadable}
                onChange={(checked: boolean) => {
                    setHistoryVisibility(checked ? HistoryVisibility.WorldReadable : HistoryVisibility.Shared);
                }}
                disabled={!canSetHistoryVisibility}
                label={_t("Preview Space")}
            />
            <div>{ _t("Allow people to preview your space before they join.") }</div>
            <b>{ _t("Recommended for public spaces.") }</b>
        </div>

        { addressesSection }
    </div>;
};

export default SpaceSettingsVisibilityTab;

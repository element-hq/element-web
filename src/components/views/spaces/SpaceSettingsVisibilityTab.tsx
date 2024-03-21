/*
Copyright 2021-2023 The Matrix.org Foundation C.I.C.

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
import { Room, EventType, GuestAccess, HistoryVisibility, JoinRule, MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import AccessibleButton from "../elements/AccessibleButton";
import AliasSettings from "../room_settings/AliasSettings";
import { useStateToggle } from "../../../hooks/useStateToggle";
import LabelledToggleSwitch from "../elements/LabelledToggleSwitch";
import { useLocalEcho } from "../../../hooks/useLocalEcho";
import JoinRuleSettings from "../settings/JoinRuleSettings";
import { useRoomState } from "../../../hooks/useRoomState";
import SettingsFieldset from "../settings/SettingsFieldset";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo";
import { SettingsSection } from "../settings/shared/SettingsSection";
import SettingsTab from "../settings/tabs/SettingsTab";

interface IProps {
    matrixClient: MatrixClient;
    space: Room;
    closeSettingsFn(): void;
}

const SpaceSettingsVisibilityTab: React.FC<IProps> = ({ matrixClient: cli, space, closeSettingsFn }) => {
    const [error, setError] = useState("");
    const serverSupportsExploringSpaces = useAsyncMemo<boolean>(
        async (): Promise<boolean> => {
            return cli.isVersionSupported("v1.4").then((supported) => {
                return supported || cli.doesServerSupportUnstableFeature("org.matrix.msc3827.stable");
            });
        },
        [cli],
        false,
    );

    const userId = cli.getUserId()!;

    const joinRule = useRoomState(space, (state) => state.getJoinRule());
    const [guestAccessEnabled, setGuestAccessEnabled] = useLocalEcho<boolean>(
        () =>
            space.currentState.getStateEvents(EventType.RoomGuestAccess, "")?.getContent()?.guest_access ===
            GuestAccess.CanJoin,
        (guestAccessEnabled) =>
            cli.sendStateEvent(
                space.roomId,
                EventType.RoomGuestAccess,
                {
                    guest_access: guestAccessEnabled ? GuestAccess.CanJoin : GuestAccess.Forbidden,
                },
                "",
            ),
        () => setError(_t("room_settings|visibility|error_update_guest_access")),
    );
    const [historyVisibility, setHistoryVisibility] = useLocalEcho<HistoryVisibility>(
        () =>
            space.currentState.getStateEvents(EventType.RoomHistoryVisibility, "")?.getContent()?.history_visibility ||
            HistoryVisibility.Shared,
        (historyVisibility) =>
            cli.sendStateEvent(
                space.roomId,
                EventType.RoomHistoryVisibility,
                {
                    history_visibility: historyVisibility,
                },
                "",
            ),
        () => setError(_t("room_settings|visibility|error_update_history_visibility")),
    );

    const [showAdvancedSection, toggleAdvancedSection] = useStateToggle();

    const canSetGuestAccess = space.currentState.maySendStateEvent(EventType.RoomGuestAccess, userId);
    const canSetHistoryVisibility = space.currentState.maySendStateEvent(EventType.RoomHistoryVisibility, userId);
    const canSetCanonical = space.currentState.mayClientSendStateEvent(EventType.RoomCanonicalAlias, cli);
    const canonicalAliasEv = space.currentState.getStateEvents(EventType.RoomCanonicalAlias, "");

    let advancedSection;
    if (joinRule === JoinRule.Public) {
        advancedSection = (
            <div>
                <AccessibleButton
                    data-testid="toggle-guest-access-btn"
                    onClick={toggleAdvancedSection}
                    kind="link"
                    className="mx_SettingsTab_showAdvanced"
                    aria-expanded={showAdvancedSection}
                >
                    {showAdvancedSection ? _t("action|hide_advanced") : _t("action|show_advanced")}
                </AccessibleButton>

                {showAdvancedSection && (
                    <div className="mx_SettingsTab_toggleWithDescription">
                        <LabelledToggleSwitch
                            value={guestAccessEnabled}
                            onChange={setGuestAccessEnabled}
                            disabled={!canSetGuestAccess}
                            label={_t("room_settings|visibility|guest_access_label")}
                        />
                        <p>
                            {_t("room_settings|visibility|guest_access_explainer")}
                            <br />
                            {_t("room_settings|visibility|guest_access_explainer_public_space")}
                        </p>
                    </div>
                )}
            </div>
        );
    }

    let addressesSection: JSX.Element | undefined;
    if (space.getJoinRule() === JoinRule.Public) {
        addressesSection = (
            <SettingsSection heading={_t("room_settings|visibility|alias_section")}>
                <AliasSettings
                    roomId={space.roomId}
                    canSetCanonicalAlias={canSetCanonical}
                    canSetAliases={true}
                    canonicalAliasEvent={canonicalAliasEv ?? undefined}
                    hidePublishSetting={!serverSupportsExploringSpaces}
                />
            </SettingsSection>
        );
    }

    return (
        <SettingsTab>
            <SettingsSection heading={_t("room_settings|visibility|title")}>
                {error && (
                    <div data-testid="space-settings-error" className="mx_SpaceRoomView_errorText">
                        {error}
                    </div>
                )}

                <SettingsFieldset
                    data-testid="access-fieldset"
                    legend={_t("room_settings|access|title")}
                    description={_t("room_settings|access|description_space", { spaceName: space.name })}
                >
                    <JoinRuleSettings
                        room={space}
                        onError={(): void => setError(_t("room_settings|visibility|error_failed_save"))}
                        closeSettingsFn={closeSettingsFn}
                    />
                    {advancedSection}
                    <div className="mx_SettingsTab_toggleWithDescription">
                        <LabelledToggleSwitch
                            value={historyVisibility === HistoryVisibility.WorldReadable}
                            onChange={(checked: boolean): void => {
                                setHistoryVisibility(
                                    checked ? HistoryVisibility.WorldReadable : HistoryVisibility.Shared,
                                );
                            }}
                            disabled={!canSetHistoryVisibility}
                            label={_t("room_settings|visibility|history_visibility_anyone_space")}
                        />
                        <p>
                            {_t("room_settings|visibility|history_visibility_anyone_space_description")}
                            <br />
                            <b>{_t("room_settings|visibility|history_visibility_anyone_space_recommendation")}</b>
                        </p>
                    </div>
                </SettingsFieldset>

                {addressesSection}
            </SettingsSection>
        </SettingsTab>
    );
};

export default SpaceSettingsVisibilityTab;

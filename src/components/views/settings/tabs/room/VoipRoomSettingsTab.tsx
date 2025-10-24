/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useCallback, useState } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../../../languageHandler";
import LabelledToggleSwitch from "../../../elements/LabelledToggleSwitch";
import { SettingsSubsection } from "../../shared/SettingsSubsection";
import SettingsTab from "../SettingsTab";
import SdkConfig, { DEFAULTS } from "../../../../../SdkConfig";
import { SettingsSection } from "../../shared/SettingsSection";
import { useElementCallPermissions } from "../../../../../hooks/room/useElementCallPermissions";

interface ElementCallSwitchProps {
    room: Room;
}

const ElementCallSwitch: React.FC<ElementCallSwitchProps> = ({ room }) => {
    // For MSC4356 only.
    const {canStartCall, canAdjustCallPermissions, enableCallInRoom, disableCallInRoom} = useElementCallPermissions(room);
    const [busy, setBusy] = useState<boolean>();
    const onToggle = useCallback(() => {
        setBusy(true)
        void (async () => {
            try {
                if (canStartCall) {
                    await disableCallInRoom();
                } else {
                    await enableCallInRoom();
                }
            } finally {
                setBusy(false);
            }
        })();

    }, [canStartCall, enableCallInRoom, disableCallInRoom]);

    const brand = SdkConfig.get("element_call").brand ?? DEFAULTS.element_call.brand;

    return (
        <LabelledToggleSwitch
            data-testid="element-call-switch"
            label={_t("room_settings|voip|enable_element_call_label", { brand })}
            caption={_t("room_settings|voip|enable_element_call_caption", {
                brand,
            })}
            value={canStartCall}
            onChange={onToggle}
            disabled={busy || !canAdjustCallPermissions}
            tooltip={canAdjustCallPermissions ? undefined : _t("room_settings|voip|enable_element_call_no_permissions_tooltip")}
        />
    );
};

interface Props {
    room: Room;
}

export const VoipRoomSettingsTab: React.FC<Props> = ({ room }) => {
    return (
        <SettingsTab>
            <SettingsSection heading={_t("settings|voip|title")}>
                <SettingsSubsection heading={_t("room_settings|voip|call_type_section")}>
                    <ElementCallSwitch room={room} />
                </SettingsSubsection>
            </SettingsSection>
        </SettingsTab>
    );
};

/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.
Copyright 2018, 2019 New Vector Ltd
Copyright 2017 Travis Ralston
Copyright 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ReactNode, type JSX } from "react";
import { type Room } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler.tsx";
import dis from "../../../dispatcher/dispatcher.ts";
import { Action } from "../../../dispatcher/actions.ts";
import { SettingLevel } from "../../../settings/SettingLevel.ts";
import SettingsFlag from "../elements/SettingsFlag.tsx";
import SettingsFieldset from "../settings/SettingsFieldset.tsx";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton.tsx";
import { useSettingValueAt } from "../../../hooks/useSettings.ts";

/**
 * The chat effects settings for a room
 */
interface ChatEffectsSettingsProps {
    /**
     * The room.
     */
    room: Room;
}

export function ChatEffectsSettings({ room }: ChatEffectsSettingsProps): JSX.Element {
    const { roomId } = room;

    return (
        <SettingsFieldset
            legend={_t("room_settings|general|chat_effects_section")}
            description={<Description />}
        >
            <>
                <SettingsFlag name="showChatEffects" level={SettingLevel.ROOM} roomId={roomId} isExplicit={true} />
            </>
        </SettingsFieldset>
    );
}

/**
 * Click handler for the user settings link
 * @param e
 */
function onClickUserSettings(e: ButtonEvent): void {
    e.preventDefault();
    e.stopPropagation();
    dis.fire(Action.ViewUserSettings);
}

/**
 * The description for the chat effects enabled settings
 */

function Description(): JSX.Element {
    const chatEffectsEnabled = useSettingValueAt(SettingLevel.ACCOUNT, "showChatEffects");

    let previewsForAccount: ReactNode | undefined;
    const button = {
        a: (sub: string) => (
            <AccessibleButton kind="link_inline" onClick={onClickUserSettings}>
                {sub}
            </AccessibleButton>
        ),
    };

    previewsForAccount = chatEffectsEnabled
        ? _t("room_settings|general|user_chat_effects_default_on", {}, button)
        : _t("room_settings|general|user_chat_effects_default_off", {}, button);

    return (
        <>
            <p>{_t("room_settings|general|chat_effects_explainer")}</p>
            <p>{previewsForAccount}</p>
        </>
    );
}
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
import { InlineSpinner } from "@vector-im/compound-web";

import { _t } from "../../../languageHandler";
import SettingsStore from "../../../settings/SettingsStore";
import dis from "../../../dispatcher/dispatcher";
import { Action } from "../../../dispatcher/actions";
import { SettingLevel } from "../../../settings/SettingLevel";
import SettingsFlag from "../elements/SettingsFlag";
import SettingsFieldset from "../settings/SettingsFieldset";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";
import { useIsEncrypted } from "../../../hooks/useIsEncrypted.ts";
import { useMatrixClientContext } from "../../../contexts/MatrixClientContext.tsx";
import { useSettingValueAt } from "../../../hooks/useSettings.ts";

/**
 * The URL preview settings for a room
 */
interface UrlPreviewSettingsProps {
    /**
     * The room.
     */
    room: Room;
}

export function UrlPreviewSettings({ room }: UrlPreviewSettingsProps): JSX.Element {
    const { roomId } = room;
    const matrixClient = useMatrixClientContext();
    const isEncrypted = useIsEncrypted(matrixClient, room);
    const isLoading = isEncrypted === null;

    return (
        <SettingsFieldset
            legend={_t("room_settings|general|url_previews_section")}
            description={!isLoading && <Description isEncrypted={isEncrypted} />}
        >
            {isLoading ? (
                <InlineSpinner />
            ) : (
                <>
                    <PreviewsForRoom isEncrypted={isEncrypted} roomId={roomId} />
                    <SettingsFlag
                        name={isEncrypted ? "urlPreviewsEnabled_e2ee" : "urlPreviewsEnabled"}
                        level={SettingLevel.ROOM_DEVICE}
                        roomId={roomId}
                    />
                </>
            )}
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
 * The description for the URL preview settings
 */
interface DescriptionProps {
    /**
     * Whether the room is encrypted
     */
    isEncrypted: boolean;
}

function Description({ isEncrypted }: DescriptionProps): JSX.Element {
    const urlPreviewsEnabled = useSettingValueAt(SettingLevel.ACCOUNT, "urlPreviewsEnabled");

    let previewsForAccount: ReactNode | undefined;
    if (isEncrypted) {
        previewsForAccount = _t("room_settings|general|url_preview_encryption_warning");
    } else {
        const button = {
            a: (sub: string) => (
                <AccessibleButton kind="link_inline" onClick={onClickUserSettings}>
                    {sub}
                </AccessibleButton>
            ),
        };

        previewsForAccount = urlPreviewsEnabled
            ? _t("room_settings|general|user_url_previews_default_on", {}, button)
            : _t("room_settings|general|user_url_previews_default_off", {}, button);
    }

    return (
        <>
            <p>{_t("room_settings|general|url_preview_explainer")}</p>
            <p>{previewsForAccount}</p>
        </>
    );
}

/**
 * The description for the URL preview settings
 */
interface PreviewsForRoomProps {
    /**
     * Whether the room is encrypted
     */
    isEncrypted: boolean;
    /**
     * The room ID
     */
    roomId: string;
}

function PreviewsForRoom({ isEncrypted, roomId }: PreviewsForRoomProps): JSX.Element | null {
    const urlPreviewsEnabled = useSettingValueAt(
        SettingLevel.ACCOUNT,
        "urlPreviewsEnabled",
        roomId,
        /*explicit=*/ true,
    );
    if (isEncrypted) return null;

    let previewsForRoom: ReactNode;
    if (SettingsStore.canSetValue("urlPreviewsEnabled", roomId, SettingLevel.ROOM)) {
        previewsForRoom = (
            <SettingsFlag name="urlPreviewsEnabled" level={SettingLevel.ROOM} roomId={roomId} isExplicit={true} />
        );
    } else {
        previewsForRoom = (
            <div>
                {urlPreviewsEnabled
                    ? _t("room_settings|general|default_url_previews_on")
                    : _t("room_settings|general|default_url_previews_off")}
            </div>
        );
    }

    return previewsForRoom;
}

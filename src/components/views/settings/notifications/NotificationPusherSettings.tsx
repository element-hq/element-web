/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { ThreepidMedium, type IPusher } from "matrix-js-sdk/src/matrix";
import React, { type JSX, useCallback, useMemo } from "react";

import { useMatrixClientContext } from "../../../../contexts/MatrixClientContext";
import { Action } from "../../../../dispatcher/actions";
import dispatcher from "../../../../dispatcher/dispatcher";
import { usePushers } from "../../../../hooks/usePushers";
import { useThreepids } from "../../../../hooks/useThreepids";
import { _t } from "../../../../languageHandler";
import SdkConfig from "../../../../SdkConfig";
import { UserTab } from "../../dialogs/UserTab";
import AccessibleButton from "../../elements/AccessibleButton";
import LabelledCheckbox from "../../elements/LabelledCheckbox";
import { SettingsIndent } from "../shared/SettingsIndent";
import { SettingsSubsection, SettingsSubsectionText } from "../shared/SettingsSubsection";

function generalTabButton(content: string): JSX.Element {
    return (
        <AccessibleButton
            kind="link_inline"
            onClick={() => {
                dispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.Account,
                });
            }}
        >
            {content}
        </AccessibleButton>
    );
}

export function NotificationPusherSettings(): JSX.Element {
    const EmailPusherTemplate: Omit<IPusher, "pushkey" | "device_display_name" | "append"> = useMemo(
        () => ({
            kind: "email",
            app_id: "m.email",
            app_display_name: _t("notifications|email_pusher_app_display_name"),
            lang: navigator.language,
            data: {
                brand: SdkConfig.get().brand,
            },
        }),
        [],
    );

    const cli = useMatrixClientContext();
    const [pushers, refreshPushers] = usePushers(cli);
    const [threepids, refreshThreepids] = useThreepids(cli);

    const setEmailEnabled = useCallback(
        (email: string, enabled: boolean) => {
            if (enabled) {
                cli.setPusher({
                    ...EmailPusherTemplate,
                    pushkey: email,
                    device_display_name: email,
                    // We always append for email pushers since we don't want to stop other
                    // accounts notifying to the same email address
                    append: true,
                }).catch((err) => console.error(err));
            } else {
                const pusher = pushers.find((p) => p.kind === "email" && p.pushkey === email);
                if (pusher) {
                    cli.removePusher(pusher.pushkey, pusher.app_id).catch((err) => console.error(err));
                }
            }
            refreshThreepids();
            refreshPushers();
        },
        [EmailPusherTemplate, cli, pushers, refreshPushers, refreshThreepids],
    );

    const notificationTargets = pushers.filter((it) => it.kind !== "email");

    return (
        <>
            <SettingsSubsection
                className="mx_NotificationPusherSettings"
                heading={_t("settings|notifications|email_section")}
            >
                <SettingsSubsectionText className="mx_NotificationPusherSettings_description">
                    {_t("settings|notifications|email_description")}
                </SettingsSubsectionText>
                <div className="mx_SettingsSubsection_description mx_NotificationPusherSettings_detail">
                    <SettingsSubsectionText>
                        {_t("settings|notifications|email_select", {}, { button: generalTabButton })}
                    </SettingsSubsectionText>
                </div>
                <SettingsIndent>
                    {threepids
                        .filter((t) => t.medium === ThreepidMedium.Email)
                        .map((email) => (
                            <LabelledCheckbox
                                key={email.address}
                                label={email.address}
                                value={pushers.find((it) => it.pushkey === email.address) !== undefined}
                                onChange={(value) => setEmailEnabled(email.address, value)}
                            />
                        ))}
                </SettingsIndent>
            </SettingsSubsection>
            {notificationTargets.length > 0 && (
                <SettingsSubsection heading={_t("settings|notifications|push_targets")}>
                    <ul>
                        {pushers
                            .filter((it) => it.kind !== "email")
                            .map((pusher) => (
                                <li key={pusher.pushkey}>{pusher.device_display_name || pusher.app_display_name}</li>
                            ))}
                    </ul>
                </SettingsSubsection>
            )}
        </>
    );
}

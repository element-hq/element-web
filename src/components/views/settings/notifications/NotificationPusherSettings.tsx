/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { ThreepidMedium } from "matrix-js-sdk/src/@types/threepids";
import { IPusher } from "matrix-js-sdk/src/matrix";
import React, { useCallback, useMemo } from "react";

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
import SettingsSubsection, { SettingsSubsectionText } from "../shared/SettingsSubsection";

function generalTabButton(content: string): JSX.Element {
    return (
        <AccessibleButton
            kind="link_inline"
            onClick={() => {
                dispatcher.dispatch({
                    action: Action.ViewUserSettings,
                    initialTabId: UserTab.General,
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
            app_display_name: _t("Email Notifications"),
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
            <SettingsSubsection className="mx_NotificationPusherSettings" heading={_t("Email summary")}>
                <SettingsSubsectionText className="mx_NotificationPusherSettings_description">
                    {_t("Receive an email summary of missed notifications")}
                </SettingsSubsectionText>
                <div className="mx_SettingsSubsection_description mx_NotificationPusherSettings_detail">
                    <SettingsSubsectionText>
                        {_t(
                            "Select which emails you want to send summaries to. Manage your emails in <button>General</button>.",
                            {},
                            { button: generalTabButton },
                        )}
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
                <SettingsSubsection heading={_t("Notification targets")}>
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

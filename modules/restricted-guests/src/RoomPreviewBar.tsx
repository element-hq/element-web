/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import { type Api, type I18nApi } from "@element-hq/element-web-module-api";
import styled from "styled-components";
import { useWatchable } from "@element-hq/element-web-module-api";

import { type ModuleConfig } from "./config.ts";
import RegisterDialog from "./RegisterDialog.tsx";

interface RoomPreviewBarProps {
    api: Api;
    /** The module's translations, namespaced with its config key */
    i18n: I18nApi;
    config: ModuleConfig;
    children: JSX.Element;
    roomId?: string;
    roomAlias?: string;
    promptAskToJoin?: boolean;
}

const Container = styled.aside`
    margin: auto;
    font: var(--cpd-font-body-md-regular);
    letter-spacing: var(--cpd-font-letter-spacing-body-md);
    font-feature-settings: normal;
`;

const RoomPreviewBar: FC<RoomPreviewBarProps> = ({
    api,
    i18n,
    config,
    roomId,
    roomAlias,
    promptAskToJoin,
    children,
}) => {
    const profile = useWatchable(api.profile);
    const isGuest = profile.isGuest;

    if (promptAskToJoin || !isGuest || !(roomId || roomAlias)) return children;

    const onTryJoin = async (): Promise<void> => {
        const { finished } = api.openDialog(
            {
                title: i18n.translate("register_dialog_title"),
            },
            RegisterDialog,
            {
                i18n,
                config,
                showLoginLink: true,
            },
        );

        const { model: accountAuthInfo, ok } = await finished;

        if (ok && accountAuthInfo) {
            await api.overwriteAccountAuth(accountAuthInfo);
            await api.navigation.toMatrixToLink(`https://matrix.to/#/${roomId ?? roomAlias}`, true);
        }
    };

    return (
        <Container className="mx_RoomPreviewBar">
            <div className="mx_RoomPreviewBar_message">{i18n.translate("join_message")}</div>
            <div className="mx_RoomPreviewBar_actions">
                <Button onClick={onTryJoin}>{i18n.translate("join_cta")}</Button>
            </div>
        </Container>
    );
};

export default RoomPreviewBar;

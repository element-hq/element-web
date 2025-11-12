/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC, type JSX } from "react";
import { Button } from "@vector-im/compound-web";
import { type Api } from "@element-hq/element-web-module-api";
import styled from "styled-components";
import { useWatchable } from "@element-hq/element-web-module-api";

import { type ModuleConfig } from "./config.ts";
import RegisterDialog from "./RegisterDialog.tsx";

interface RoomPreviewBarProps {
    api: Api;
    config: ModuleConfig;
    children: JSX.Element;
    roomId?: string;
    roomAlias?: string;
    promptAskToJoin?: boolean;
}

const Container = styled.aside`
    margin: auto;
`;

const RoomPreviewBar: FC<RoomPreviewBarProps> = ({ api, config, roomId, roomAlias, promptAskToJoin, children }) => {
    const profile = useWatchable(api.profile);
    const isGuest = profile.isGuest;

    if (promptAskToJoin || !isGuest || !(roomId || roomAlias)) return children;

    const onTryJoin = async (): Promise<void> => {
        const { finished } = api.openDialog(
            {
                title: api.i18n.translate("register_dialog_title"),
            },
            RegisterDialog,
            {
                api,
                config,
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
            <div className="mx_RoomPreviewBar_message">{api.i18n.translate("join_message")}</div>
            <div className="mx_RoomPreviewBar_actions">
                <Button onClick={onTryJoin}>{api.i18n.translate("join_cta")}</Button>
            </div>
        </Container>
    );
};

export default RoomPreviewBar;

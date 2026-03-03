/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import { Button } from "@vector-im/compound-web";
import { type AccountAuthInfo, type Api } from "@element-hq/element-web-module-api";
import styled from "styled-components";

import { type ModuleConfig } from "./config.ts";
import RegisterDialog from "./RegisterDialog.tsx";

interface Props {
    api: Api;
    config: ModuleConfig;
    onLoggedIn(data: AccountAuthInfo): void;
}

const Container = styled.aside`
    margin: var(--cpd-space-3x) 0;

    button {
        width: 100%;
    }
`;

const AuthFooter: FC<Props> = ({ api, config, onLoggedIn }) => {
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
            onLoggedIn(accountAuthInfo);
        }
    };

    return (
        <Container>
            <Button onClick={onTryJoin} size="sm" kind="secondary">
                {api.i18n.translate("join_cta")}
            </Button>
        </Container>
    );
};

export default AuthFooter;

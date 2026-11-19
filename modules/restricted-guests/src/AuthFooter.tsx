/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type FC } from "react";
import { Button } from "@vector-im/compound-web";
import { type AccountAuthInfo, type Api, type I18nApi } from "@element-hq/element-web-module-api";
import styled from "styled-components";

import { type ModuleConfig } from "./config.ts";
import RegisterDialog from "./RegisterDialog.tsx";

interface Props {
    api: Api;
    /** The module's translations, namespaced with its config key */
    i18n: I18nApi;
    config: ModuleConfig;
    onLoggedIn(this: void, data: AccountAuthInfo): void;
}

const Container = styled.aside`
    margin: var(--cpd-space-3x) 0;

    button {
        width: 100%;
    }
`;

const AuthFooter: FC<Props> = ({ api, i18n, config, onLoggedIn }) => {
    const onTryJoin = async (): Promise<void> => {
        const { finished } = api.openDialog(
            {
                title: i18n.translate("register_dialog_title"),
            },
            RegisterDialog,
            {
                i18n,
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
            <Button onClick={onTryJoin} size="md" kind="secondary">
                {i18n.translate("join_cta")}
            </Button>
        </Container>
    );
};

export default AuthFooter;

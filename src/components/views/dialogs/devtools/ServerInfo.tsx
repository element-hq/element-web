/*
Copyright 2024 New Vector Ltd.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import BaseTool, { type IDevtoolsProps } from "./BaseTool";
import { _t } from "../../../../languageHandler";
import { useAsyncMemo } from "../../../../hooks/useAsyncMemo";
import MatrixClientContext from "../../../../contexts/MatrixClientContext";
import Spinner from "../../elements/Spinner";
import SyntaxHighlight from "../../elements/SyntaxHighlight";
import { MatrixClientPeg } from "../../../../MatrixClientPeg";

const FAILED_TO_LOAD = Symbol("failed-to-load");

interface IServerWellKnown {
    server: {
        name: string;
        version: string;
    };
}

export async function getServerVersionFromFederationApi(client: MatrixClient): Promise<IServerWellKnown> {
    let baseUrl = client.getHomeserverUrl();

    try {
        const hsName = MatrixClientPeg.safeGet().getDomain();
        // We don't use the js-sdk Autodiscovery module here as it only support client well-known, not server ones.
        const response = await fetch(`https://${hsName}/.well-known/matrix/server`);
        const json = await response.json();
        if (json["m.server"]) {
            baseUrl = `https://${json["m.server"]}`;
        }
    } catch (e) {
        console.warn(e);
    }

    const response = await fetch(`${baseUrl}/_matrix/federation/v1/version`);
    return response.json();
}

const ServerInfo: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const cli = useContext(MatrixClientContext);
    const capabilities = useAsyncMemo(() => cli.fetchCapabilities().catch(() => FAILED_TO_LOAD), [cli]);
    const clientVersions = useAsyncMemo(() => cli.getVersions().catch(() => FAILED_TO_LOAD), [cli]);
    const serverVersions = useAsyncMemo(async (): Promise<IServerWellKnown | symbol> => {
        try {
            return await getServerVersionFromFederationApi(cli);
        } catch (e) {
            console.warn(e);
        }

        return FAILED_TO_LOAD;
    }, [cli]);

    let body: JSX.Element;
    if (!capabilities || !clientVersions || !serverVersions) {
        body = <Spinner />;
    } else {
        body = (
            <>
                <h4>{_t("common|capabilities")}</h4>
                {capabilities !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(capabilities, null, 4)} />
                ) : (
                    <div>{_t("devtools|failed_to_load")}</div>
                )}

                <h4>{_t("devtools|client_versions")}</h4>
                {clientVersions !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(clientVersions, null, 4)} />
                ) : (
                    <div>{_t("devtools|failed_to_load")}</div>
                )}

                <h4>{_t("devtools|server_versions")}</h4>
                {serverVersions !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(serverVersions, null, 4)} />
                ) : (
                    <div>{_t("devtools|failed_to_load")}</div>
                )}
            </>
        );
    }

    return <BaseTool onBack={onBack}>{body}</BaseTool>;
};

export default ServerInfo;

/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

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

import React, { useContext } from "react";

import BaseTool, { IDevtoolsProps } from "./BaseTool";
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

const ServerInfo: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const cli = useContext(MatrixClientContext);
    const capabilities = useAsyncMemo(() => cli.getCapabilities(true).catch(() => FAILED_TO_LOAD), [cli]);
    const clientVersions = useAsyncMemo(() => cli.getVersions().catch(() => FAILED_TO_LOAD), [cli]);
    const serverVersions = useAsyncMemo(async (): Promise<IServerWellKnown | symbol> => {
        let baseUrl = cli.getHomeserverUrl();

        try {
            const hsName = MatrixClientPeg.getHomeserverName();
            // We don't use the js-sdk Autodiscovery module here as it only support client well-known, not server ones.
            const response = await fetch(`https://${hsName}/.well-known/matrix/server`);
            const json = await response.json();
            if (json["m.server"]) {
                baseUrl = `https://${json["m.server"]}`;
            }
        } catch (e) {
            console.warn(e);
        }

        try {
            const response = await fetch(`${baseUrl}/_matrix/federation/v1/version`);
            return response.json();
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
                <h4>{_t("Capabilities")}</h4>
                {capabilities !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(capabilities, null, 4)} />
                ) : (
                    <div>{_t("Failed to load.")}</div>
                )}

                <h4>{_t("Client Versions")}</h4>
                {clientVersions !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(clientVersions, null, 4)} />
                ) : (
                    <div>{_t("Failed to load.")}</div>
                )}

                <h4>{_t("Server Versions")}</h4>
                {serverVersions !== FAILED_TO_LOAD ? (
                    <SyntaxHighlight language="json" children={JSON.stringify(serverVersions, null, 4)} />
                ) : (
                    <div>{_t("Failed to load.")}</div>
                )}
            </>
        );
    }

    return <BaseTool onBack={onBack}>{body}</BaseTool>;
};

export default ServerInfo;

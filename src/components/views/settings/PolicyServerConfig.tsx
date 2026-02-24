/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type FormEvent, type JSX, useContext, useState } from "react";
import { EventType, type Room } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { useRoomState } from "../../../hooks/useRoomState.ts";
import SettingsFieldset from "./SettingsFieldset.tsx";
import Field from "../elements/Field.tsx";
import AccessibleButton from "../elements/AccessibleButton.tsx";
import { useAsyncMemo } from "../../../hooks/useAsyncMemo.ts";
import ExternalLink from "../elements/ExternalLink.tsx";

interface PolicyServerConfigProps {
    room: Room;
}

export const PolicyServerConfig: React.FC<PolicyServerConfigProps> = ({ room }) => {
    const client = useContext(MatrixClientContext);
    const { policyServerEvent, canChange } = useRoomState(room, (roomState) => ({
        policyServerEvent: roomState.events.get(EventType.RoomPolicy)?.get(""),
        canChange: roomState.maySendStateEvent(EventType.RoomPolicy, client.getSafeUserId()),
    }));
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const currentPolicyServerName = policyServerEvent?.getContent()?.["via"] ?? "";
    const [serverName, setServerName] = useState<string>(currentPolicyServerName);
    const [error, setError] = useState<boolean>(false);
    const supportUrl = useAsyncMemo(
        async (): Promise<string | undefined> => {
            if (!currentPolicyServerName) {
                return undefined;
            }

            const res = await (await fetch(`https://${currentPolicyServerName}/.well-known/matrix/support`)).json();
            if (!!res["support_page"] && typeof res["support_page"] === "string") {
                return res["support_page"];
            }

            return undefined;
        },
        [serverName, currentPolicyServerName],
        undefined,
    );

    const onSubmit = async (event: FormEvent): Promise<void> => {
        event.preventDefault();
        await applyChange();
    };

    const applyChange = async (): Promise<void> => {
        setIsLoading(true);
        setError(false);

        try {
            if (serverName.trim().length > 0) {
                // We force HTTPS on non-localhost environments
                let hostname = serverName.trim();
                let urlBase = `https://${hostname}`;
                if (hostname.startsWith("http://localhost:")) {
                    urlBase = serverName.trim();
                    hostname = hostname.substring("http://".length);
                }
                const res = await (
                    await fetch(`${urlBase}/.well-known/matrix/org.matrix.msc4284.policy_server`)
                ).json();
                if (!!res["public_key"] && typeof res["public_key"] === "string") {
                    await client.sendStateEvent(
                        room.roomId,
                        EventType.RoomPolicy,
                        {
                            via: hostname,
                            public_key: res["public_key"],
                        },
                        "",
                    );
                } else {
                    logger.error("Policy server returned non-string public key (or returned an error)");
                    setError(true);
                }
            } else {
                // Empty object == remove
                await client.sendStateEvent(room.roomId, EventType.RoomPolicy, {}, "");
            }
        } catch (e) {
            logger.error(e);
            setError(true);
        }

        setIsLoading(false);
    };

    let supportSection: JSX.Element | undefined;
    if (!!currentPolicyServerName) {
        if (!!supportUrl) {
            supportSection = (
                <span>
                    {_t(
                        "room_settings|permissions|policy_server_support_page",
                        {},
                        {
                            a: (sub) => <ExternalLink href={supportUrl}>{sub}</ExternalLink>,
                        },
                    )}
                </span>
            );
        } else {
            supportSection = <span>{_t("room_settings|permissions|policy_server_generic_support")}</span>;
        }
    }

    return (
        <form style={{ display: "flex" }} onSubmit={onSubmit}>
            <SettingsFieldset
                legend={_t("room_settings|permissions|policy_server_title")}
                description={_t("room_settings|permissions|policy_server_description")}
                style={{ flexGrow: 1 }}
            >
                <Field
                    label={_t("room_settings|permissions|policy_server_field_label")}
                    type="text"
                    value={serverName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setServerName(e.target.value)}
                    autoComplete="off"
                    disabled={isLoading || !canChange}
                />
                <AccessibleButton
                    onClick={onSubmit}
                    kind="primary"
                    disabled={isLoading || !canChange || serverName === currentPolicyServerName}
                >
                    {_t("action|apply")}
                </AccessibleButton>
                {error ? (
                    <span className="error">{_t("room_settings|permissions|policy_server_error")}</span>
                ) : undefined}
                {supportSection}
            </SettingsFieldset>
        </form>
    );
};

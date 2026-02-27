/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useContext, useMemo } from "react";
import { EventType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";

import BaseTool, { DevtoolsContext, type IDevtoolsProps } from "./BaseTool";
import { _t } from "../../../../languageHandler";

const ServersInRoom: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const context = useContext(DevtoolsContext);

    const servers = useMemo<Record<string, number>>(() => {
        const servers: Record<string, number> = {};
        context.room.currentState.getStateEvents(EventType.RoomMember).forEach((ev) => {
            if (ev.getContent().membership !== KnownMembership.Join) return; // only count joined users
            const server = ev.getSender()!.split(":")[1];
            servers[server] = (servers[server] ?? 0) + 1;
        });
        return servers;
    }, [context.room]);

    return (
        <BaseTool onBack={onBack}>
            <table>
                <thead>
                    <tr>
                        <th>{_t("common|server")}</th>
                        <th>{_t("devtools|number_of_users")}</th>
                    </tr>
                </thead>
                <tbody>
                    {Object.entries(servers).map(([server, numUsers]) => (
                        <tr key={server}>
                            <td>{server}</td>
                            <td>{numUsers}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </BaseTool>
    );
};

export default ServersInRoom;

/*
Copyright 2022 Michael Telatynski <7t3chguy@gmail.com>
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

import React, { useContext, useMemo } from "react";
import { EventType } from "matrix-js-sdk/src/@types/event";

import BaseTool, { DevtoolsContext, IDevtoolsProps } from "./BaseTool";
import { _t } from "../../../../languageHandler";

const ServersInRoom: React.FC<IDevtoolsProps> = ({ onBack }) => {
    const context = useContext(DevtoolsContext);

    const servers = useMemo<Record<string, number>>(() => {
        const servers: Record<string, number> = {};
        context.room.currentState.getStateEvents(EventType.RoomMember).forEach((ev) => {
            if (ev.getContent().membership !== "join") return; // only count joined users
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
                        <th>{_t("Server")}</th>
                        <th>{_t("Number of users")}</th>
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

/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import { useCallback, useEffect, useState } from "react";
import { IProtocol, IPublicRoomsChunkRoom } from "matrix-js-sdk/src/client";
import { IRoomDirectoryOptions } from "matrix-js-sdk/src/@types/requests";

import { MatrixClientPeg } from "../MatrixClientPeg";
import SdkConfig from "../SdkConfig";
import SettingsStore from "../settings/SettingsStore";
import { Protocols } from "../utils/DirectoryUtils";

export const ALL_ROOMS = "ALL_ROOMS";
const LAST_SERVER_KEY = "mx_last_room_directory_server";
const LAST_INSTANCE_KEY = "mx_last_room_directory_instance";

export interface IPublicRoomsOpts {
    limit: number;
    query?: string;
}

let thirdParty: Protocols;

export const usePublicRoomDirectory = () => {
    const [publicRooms, setPublicRooms] = useState<IPublicRoomsChunkRoom[]>([]);

    const [roomServer, setRoomServer] = useState<string | null | undefined>(undefined);
    const [instanceId, setInstanceId] = useState<string | null | undefined>(undefined);
    const [protocols, setProtocols] = useState<Protocols | null>(null);

    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);

    async function initProtocols() {
        if (!MatrixClientPeg.get()) {
            // We may not have a client yet when invoked from welcome page
            setReady(true);
        } else if (thirdParty) {
            setProtocols(thirdParty);
        } else {
            const response = await MatrixClientPeg.get().getThirdpartyProtocols();
            thirdParty = response;
            setProtocols(response);
        }
    }

    function setConfig(server: string, instanceId?: string) {
        if (!ready) {
            throw new Error("public room configuration not initialised yet");
        } else {
            setRoomServer(server);
            setInstanceId(instanceId ?? null);
        }
    }

    const search = useCallback(async ({
        limit = 20,
        query,
    }: IPublicRoomsOpts): Promise<boolean> => {
        if (!query?.length) {
            setPublicRooms([]);
            return true;
        }

        const opts: IRoomDirectoryOptions = { limit };

        if (roomServer != MatrixClientPeg.getHomeserverName()) {
            opts.server = roomServer;
        }

        if (instanceId === ALL_ROOMS) {
            opts.include_all_networks = true;
        } else if (instanceId) {
            opts.third_party_instance_id = instanceId;
        }

        if (query) {
            opts.filter = {
                generic_search_term: query,
            };
        }

        try {
            setLoading(true);
            const { chunk } = await MatrixClientPeg.get().publicRooms(opts);
            setPublicRooms(chunk);
            return true;
        } catch (e) {
            console.error("Could not fetch public rooms for params", opts, e);
            setPublicRooms([]);
            return false;
        } finally {
            setLoading(false);
        }
    }, [roomServer, instanceId]);

    useEffect(() => {
        initProtocols();
    }, []);

    useEffect(() => {
        if (protocols === null) {
            return;
        }

        const myHomeserver = MatrixClientPeg.getHomeserverName();
        const lsRoomServer = localStorage.getItem(LAST_SERVER_KEY);
        const lsInstanceId = localStorage.getItem(LAST_INSTANCE_KEY);

        let roomServer = myHomeserver;
        if (
            SdkConfig.getObject("room_directory")?.get("servers")?.includes(lsRoomServer) ||
                    SettingsStore.getValue("room_directory_servers")?.includes(lsRoomServer)
        ) {
            roomServer = lsRoomServer;
        }

        let instanceId: string | null = null;
        if (roomServer === myHomeserver && (
            lsInstanceId === ALL_ROOMS ||
                    Object.values(protocols).some((p: IProtocol) => {
                        p.instances.some(i => i.instance_id === lsInstanceId);
                    })
        )) {
            instanceId = lsInstanceId;
        }

        setReady(true);
        setInstanceId(instanceId);
        setRoomServer(roomServer);
    }, [protocols]);

    useEffect(() => {
        localStorage.setItem(LAST_SERVER_KEY, roomServer);
    }, [roomServer]);

    useEffect(() => {
        localStorage.setItem(LAST_INSTANCE_KEY, instanceId);
    }, [instanceId]);

    return {
        ready,
        loading,
        publicRooms,
        protocols,
        roomServer,
        instanceId,
        search,
        setConfig,
    } as const;
};

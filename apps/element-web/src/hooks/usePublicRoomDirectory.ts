/*
Copyright 2024 New Vector Ltd.
Copyright 2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type RoomType,
    type IProtocol,
    type IPublicRoomsChunkRoom,
    type IRoomDirectoryOptions,
} from "matrix-js-sdk/src/matrix";
import { useCallback, useEffect, useState } from "react";

import { type IPublicRoomDirectoryConfig } from "../components/views/directory/NetworkDropdown";
import { MatrixClientPeg } from "../MatrixClientPeg";
import SdkConfig from "../SdkConfig";
import SettingsStore from "../settings/SettingsStore";
import { type Protocols } from "../utils/DirectoryUtils";
import { useLatestResult } from "./useLatestResult";
import { useSettingValue } from "./useSettings";

export const ALL_ROOMS = "ALL_ROOMS";
const LAST_SERVER_KEY = "mx_last_room_directory_server";
const LAST_INSTANCE_KEY = "mx_last_room_directory_instance";

export interface IPublicRoomsOpts {
    limit: number;
    query?: string;
    roomTypes?: Set<RoomType | null>;
}

let thirdParty: Protocols;

const NSFW_KEYWORD = "nsfw";
const cheapNsfwFilter = (room: IPublicRoomsChunkRoom): boolean =>
    !room.name?.toLocaleLowerCase().includes(NSFW_KEYWORD) && !room.topic?.toLocaleLowerCase().includes(NSFW_KEYWORD);

export const usePublicRoomDirectory = (): {
    ready: boolean;
    loading: boolean;
    publicRooms: IPublicRoomsChunkRoom[];
    protocols: Protocols | null;
    config?: IPublicRoomDirectoryConfig | null;
    setConfig(config: IPublicRoomDirectoryConfig | null): void;
    search(opts: IPublicRoomsOpts): Promise<boolean>;
    error?: Error | true; // true if an unknown error is encountered
} => {
    const [publicRooms, setPublicRooms] = useState<IPublicRoomsChunkRoom[]>([]);

    const [config, setConfigInternal] = useState<IPublicRoomDirectoryConfig | null | undefined>(undefined);

    const [protocols, setProtocols] = useState<Protocols | null>(null);

    const [ready, setReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | true | undefined>();

    const [updateQuery, updateResult] = useLatestResult<IRoomDirectoryOptions, IPublicRoomsChunkRoom[]>(setPublicRooms);

    const showNsfwPublicRooms = useSettingValue("SpotlightSearch.showNsfwPublicRooms");

    async function initProtocols(): Promise<void> {
        if (!MatrixClientPeg.get()) {
            // We may not have a client yet when invoked from welcome page
            setReady(true);
        } else if (thirdParty) {
            setProtocols(thirdParty);
        } else {
            const response = await MatrixClientPeg.safeGet().getThirdpartyProtocols();
            thirdParty = response;
            setProtocols(response);
        }
    }

    function setConfig(config: IPublicRoomDirectoryConfig): void {
        if (!ready) {
            throw new Error("public room configuration not initialised yet");
        } else {
            setConfigInternal(config);
        }
    }

    const search = useCallback(
        async ({ limit = 20, query, roomTypes }: IPublicRoomsOpts): Promise<boolean> => {
            const opts: IRoomDirectoryOptions = { limit };

            if (config?.roomServer != MatrixClientPeg.safeGet().getDomain()) {
                opts.server = config?.roomServer;
            }

            if (config?.instanceId === ALL_ROOMS) {
                opts.include_all_networks = true;
            } else if (config?.instanceId) {
                opts.third_party_instance_id = config.instanceId;
            }

            if (query || roomTypes) {
                opts.filter = {
                    generic_search_term: query,
                    room_types:
                        roomTypes &&
                        (await MatrixClientPeg.safeGet().doesServerSupportUnstableFeature("org.matrix.msc3827.stable"))
                            ? Array.from<RoomType | null>(roomTypes)
                            : undefined,
                };
            }

            updateQuery(opts);
            setLoading(true);
            setError(undefined);
            try {
                const { chunk } = await MatrixClientPeg.safeGet().publicRooms(opts);
                updateResult(opts, showNsfwPublicRooms ? chunk : chunk.filter(cheapNsfwFilter));
                return true;
            } catch (e) {
                setError(e instanceof Error ? e : true);
                console.error("Could not fetch public rooms for params", opts, e);
                updateResult(opts, []);
                return false;
            } finally {
                setLoading(false);
            }
        },
        [config, updateQuery, updateResult, showNsfwPublicRooms],
    );

    useEffect(() => {
        initProtocols();
    }, []);

    useEffect(() => {
        if (protocols === null) {
            return;
        }

        const myHomeserver = MatrixClientPeg.safeGet().getDomain()!;
        const lsRoomServer = localStorage.getItem(LAST_SERVER_KEY);
        const lsInstanceId: string | undefined = localStorage.getItem(LAST_INSTANCE_KEY) ?? undefined;

        let roomServer: string = myHomeserver;
        if (
            lsRoomServer &&
            (SdkConfig.getObject("room_directory")?.get("servers")?.includes(lsRoomServer) ||
                SettingsStore.getValue("room_directory_servers")?.includes(lsRoomServer))
        ) {
            roomServer = lsRoomServer!;
        }

        let instanceId: string | undefined = undefined;
        if (
            roomServer === myHomeserver &&
            (lsInstanceId === ALL_ROOMS ||
                Object.values(protocols).some((p: IProtocol) => {
                    p.instances.some((i) => i.instance_id === lsInstanceId);
                }))
        ) {
            instanceId = lsInstanceId;
        }

        setReady(true);
        setConfigInternal({ roomServer, instanceId });
    }, [protocols]);

    useEffect(() => {
        if (!config) return;
        localStorage.setItem(LAST_SERVER_KEY, config.roomServer);
        if (config.instanceId) {
            localStorage.setItem(LAST_INSTANCE_KEY, config.instanceId);
        } else {
            localStorage.removeItem(LAST_INSTANCE_KEY);
        }
    }, [config]);

    return {
        ready,
        loading,
        publicRooms,
        protocols,
        config,
        search,
        setConfig,
        error,
    } as const;
};

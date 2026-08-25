/*
Copyright 2026 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { useEffect, useState } from "react";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { type Protocols } from "../utils/DirectoryUtils";
import { useUnstableFeatureSupport } from "./useUnstableFeatureSupport";

// Third-party protocol metadata changes rarely: cache per server for the session.
const protocolsCache = new Map<string, Protocols>();

/**
 * Fetch third-party protocol metadata (bridged networks and their instances)
 * for each of the given servers. The local homeserver is queried directly;
 * other servers are queried via the federated `?server=` extension, and
 * servers which don't support it (or have no bridges) simply yield an empty
 * entry.
 */
export function useThirdPartyProtocols(servers: string[]): Record<string, Protocols> {
    const [protocolsByServer, setProtocolsByServer] = useState<Record<string, Protocols>>({});
    const serversKey = servers.join("\n");
    // Remote lookups go via the MSC4517 `?server=` extension, so only attempt
    // them when our homeserver advertises support.
    const supportsRemoteLookup = useUnstableFeatureSupport("org.matrix.msc4517.thirdparty");

    useEffect(() => {
        let cancelled = false;
        const cli = MatrixClientPeg.get();
        if (!cli) return;
        const homeServer = cli.getDomain();

        const merge = (server: string, protocols: Protocols): void => {
            if (cancelled) return;
            setProtocolsByServer((prev) => (prev[server] === protocols ? prev : { ...prev, [server]: protocols }));
        };

        for (const server of serversKey.split("\n").filter(Boolean)) {
            if (server !== homeServer && !supportsRemoteLookup) {
                // Don't cache the miss: support may still be resolving, and
                // the effect re-runs if it lands as true.
                merge(server, {});
                continue;
            }
            const cached = protocolsCache.get(server);
            if (cached) {
                merge(server, cached);
                continue;
            }
            cli.getThirdpartyProtocols(server === homeServer ? undefined : server).then(
                (response) => {
                    protocolsCache.set(server, response);
                    merge(server, response);
                },
                () => {
                    // No bridges, or the server doesn't support the lookup: cache
                    // the miss so we don't hammer it on every render.
                    protocolsCache.set(server, {});
                    merge(server, protocolsCache.get(server)!);
                },
            );
        }

        return () => {
            cancelled = true;
        };
    }, [serversKey, supportsRemoteLookup]);

    return protocolsByServer;
}

/**
 * Find the protocol key (e.g. "xmpp") and metadata for a given instance ID
 * within a server's protocols.
 */
export function findProtocolForInstance(
    protocols: Protocols | undefined,
    instanceId: string | undefined,
): { protocolKey: string; protocol: Protocols[string] } | undefined {
    if (!protocols || !instanceId) return undefined;
    for (const [protocolKey, protocol] of Object.entries(protocols)) {
        if (protocol.instances?.some((instance) => instance.instance_id === instanceId)) {
            return { protocolKey, protocol };
        }
    }
    return undefined;
}

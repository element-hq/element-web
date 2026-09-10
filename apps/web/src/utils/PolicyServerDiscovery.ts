/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/src/logger";
import { type PolicyServerWellKnown, type RoomPolicyPublicKeys } from "matrix-js-sdk/src/types";

const WELL_KNOWN_TIMEOUT_MS = 10_000;

/**
 * Turn user input into a bare Matrix server name: trims whitespace and strips a pasted scheme or path,
 * so `https://policy.example.org/` becomes `policy.example.org`.
 */
export function normalisePolicyServerName(input: string): string {
    return input
        .trim()
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
        .replace(/[/?#].*$/, "");
}

async function fetchWellKnown(serverName: string, document: string): Promise<unknown> {
    // Well-known documents live on the server name itself, not on the client-server API base URL,
    // and the spec requires https.
    const url = `https://${serverName}/.well-known/matrix/${document}`;
    const response = await fetch(url, {
        method: "GET",
        credentials: "omit",
        signal: AbortSignal.timeout(WELL_KNOWN_TIMEOUT_MS),
    });
    if (!response.ok) {
        throw new Error(`Request to ${url} failed with HTTP ${response.status}`);
    }
    return response.json();
}

function isPublicKeys(value: unknown): value is RoomPolicyPublicKeys {
    if (typeof value !== "object" || value === null) return false;
    const keys = value as Record<string, unknown>;
    return (
        typeof keys.ed25519 === "string" &&
        keys.ed25519.length > 0 &&
        Object.values(keys).every((key) => typeof key === "string")
    );
}

/**
 * Look up a policy server's public keys via `GET https://<serverName>/.well-known/matrix/policy_server`.
 *
 * @param serverName - the server name of the policy server, as entered by the user.
 * @returns the well-known document, validated to contain at least an `ed25519` key.
 * @throws if the document cannot be fetched or does not contain valid public keys.
 */
export async function lookupPolicyServer(serverName: string): Promise<PolicyServerWellKnown> {
    const body = (await fetchWellKnown(serverName, "policy_server")) as { public_keys?: unknown } | null;
    const publicKeys = body?.public_keys;
    if (!isPublicKeys(publicKeys)) {
        throw new Error(`Policy server ${serverName} did not advertise a valid public_keys.ed25519`);
    }
    return { public_keys: publicKeys };
}

/**
 * Look up the support page a server advertises via `GET https://<serverName>/.well-known/matrix/support`.
 *
 * @param serverName - the server name to query.
 * @returns the absolute http(s) URL of the support page, or `undefined` if the server does not advertise one.
 */
export async function lookupSupportPage(serverName: string): Promise<string | undefined> {
    try {
        const body = (await fetchWellKnown(serverName, "support")) as { support_page?: unknown } | null;
        const supportPage = body?.support_page;
        // The value comes from a third party, so only accept web URLs.
        if (typeof supportPage === "string" && /^https?:\/\//i.test(supportPage)) {
            return supportPage;
        }
    } catch (e) {
        logger.debug(`No support page found for ${serverName}`, e);
    }
    return undefined;
}

/**
 * The network lookups needed to configure a policy server, bundled so they can be replaced in tests.
 */
export interface PolicyServerDiscovery {
    lookupPolicyServer: typeof lookupPolicyServer;
    lookupSupportPage: typeof lookupSupportPage;
}

export const defaultPolicyServerDiscovery: PolicyServerDiscovery = {
    lookupPolicyServer,
    lookupSupportPage,
};

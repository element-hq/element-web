/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import isIp from "is-ip";
import * as utils from "matrix-js-sdk/src/utils";
import { type Room, type MatrixClient, RoomStateEvent, EventType } from "matrix-js-sdk/src/matrix";
import { KnownMembership } from "matrix-js-sdk/src/types";
import { logger } from "matrix-js-sdk/src/logger";

import MatrixToPermalinkConstructor, {
    baseUrl as matrixtoBaseUrl,
    baseUrlPattern as matrixToBaseUrlPattern,
} from "./MatrixToPermalinkConstructor";
import { type PermalinkParts } from "./PermalinkConstructor";
import type PermalinkConstructor from "./PermalinkConstructor";
import ElementPermalinkConstructor from "./ElementPermalinkConstructor";
import SdkConfig from "../../SdkConfig";
import { ELEMENT_URL_PATTERN } from "../../linkify-matrix";
import MatrixSchemePermalinkConstructor from "./MatrixSchemePermalinkConstructor";

// The maximum number of servers to pick when working out which servers
// to add to permalinks. The servers are appended as ?via=example.org
const MAX_SERVER_CANDIDATES = 3;

const ANY_REGEX = /.*/;

// Permalinks can have servers appended to them so that the user
// receiving them can have a fighting chance at joining the room.
// These servers are called "candidates" at this point because
// it is unclear whether they are going to be useful to actually
// join in the future.
//
// We pick 3 servers based on the following criteria:
//
//   Server 1: The highest power level user in the room, provided
//   they are at least PL 50. We don't calculate "what is a moderator"
//   here because it is less relevant for the vast majority of rooms.
//   We also want to ensure that we get an admin or high-ranking mod
//   as they are less likely to leave the room. If no user happens
//   to meet this criteria, we'll pick the most popular server in the
//   room.
//
//   Server 2: The next most popular server in the room (in user
//   distribution). This cannot be the same as Server 1. If no other
//   servers are available then we'll only return Server 1.
//
//   Server 3: The next most popular server by user distribution. This
//   has the same rules as Server 2, with the added exception that it
//   must be unique from Server 1 and 2.

// Rationale for popular servers: It's hard to get rid of people when
// they keep flocking in from a particular server. Sure, the server could
// be ACL'd in the future or for some reason be evicted from the room
// however an event like that is unlikely the larger the room gets. If
// the server is ACL'd at the time of generating the link however, we
// shouldn't pick them. We also don't pick IP addresses.

// Note: we don't pick the server the room was created on because the
// homeserver should already be using that server as a last ditch attempt
// and there's less of a guarantee that the server is a resident server.
// Instead, we actively figure out which servers are likely to be residents
// in the future and try to use those.

// Note: Users receiving permalinks that happen to have all 3 potential
// servers fail them (in terms of joining) are somewhat expected to hunt
// down the person who gave them the link to ask for a participating server.
// The receiving user can then manually append the known-good server to
// the list and magically have the link work.

export class RoomPermalinkCreator {
    private roomId: string;
    private highestPlUserId: string | null = null;
    private populationMap: { [serverName: string]: number } = {};
    private bannedHostsRegexps: RegExp[] = [];
    private allowedHostsRegexps: RegExp[] = [];
    private _serverCandidates?: string[];
    private started = false;

    // We support being given a roomId as a fallback in the event the `room` object
    // doesn't exist or is not healthy for us to rely on. For example, loading a
    // permalink to a room which the MatrixClient doesn't know about.
    // Some of the tests done by this class are relatively expensive, so normally
    // throttled to not happen on every update. Pass false as the shouldThrottle
    // param to disable this behaviour, eg. for tests.
    public constructor(
        private room: Room | null,
        roomId: string | null = null,
        shouldThrottle = true,
    ) {
        this.roomId = room ? room.roomId : roomId!;

        if (!this.roomId) {
            throw new Error("Failed to resolve a roomId for the permalink creator to use");
        }
    }

    public load(): void {
        if (!this.room || !this.room.currentState) {
            // Under rare and unknown circumstances it is possible to have a room with no
            // currentState, at least potentially at the early stages of joining a room.
            // To avoid breaking everything, we'll just warn rather than throw as well as
            // not bother updating the various aspects of the share link.
            logger.warn("Tried to load a permalink creator with no room state");
            return;
        }
        this.fullUpdate();
    }

    public start(): void {
        if (this.started) return;
        this.load();
        this.room?.currentState.on(RoomStateEvent.Update, this.onRoomStateUpdate);
        this.started = true;
    }

    public stop(): void {
        this.room?.currentState.removeListener(RoomStateEvent.Update, this.onRoomStateUpdate);
        this.started = false;
    }

    public get serverCandidates(): string[] | undefined {
        return this._serverCandidates;
    }

    public forEvent(eventId: string): string {
        return getPermalinkConstructor().forEvent(this.roomId, eventId, this._serverCandidates);
    }

    public forShareableRoom(): string {
        if (this.room) {
            // Prefer to use canonical alias for permalink if possible
            const alias = this.room.getCanonicalAlias();
            if (alias) {
                return getPermalinkConstructor().forRoom(alias);
            }
        }
        return getPermalinkConstructor().forRoom(this.roomId, this._serverCandidates);
    }

    public forRoom(): string {
        return getPermalinkConstructor().forRoom(this.roomId, this._serverCandidates);
    }

    private onRoomStateUpdate = (): void => {
        this.fullUpdate();
    };

    private fullUpdate(): void {
        // This updates the internal state of this object from the room state. It's broken
        // down into separate functions, previously because we did some of these as incremental
        // updates, but they were on member events which can be very numerous, so the incremental
        // updates ended up being much slower than a full update. We now have the batch state update
        // event, so we just update in full, but on each batch of updates.
        this.updateAllowedServers();
        this.updateHighestPlUser();
        this.updatePopulationMap();
        this.updateServerCandidates();
    }

    private updateHighestPlUser(): void {
        const plEvent = this.room?.currentState.getStateEvents("m.room.power_levels", "");
        if (plEvent) {
            const content = plEvent.getContent();
            if (content) {
                const users: Record<string, number> = content.users;
                if (users) {
                    const entries = Object.entries(users);
                    const allowedEntries = entries.filter(([userId]) => {
                        const member = this.room?.getMember(userId);
                        if (!member || member.membership !== KnownMembership.Join) {
                            return false;
                        }
                        const serverName = getServerName(userId);

                        const domain = getHostnameFromMatrixServerName(serverName) ?? serverName;
                        return (
                            !isHostnameIpAddress(domain) &&
                            !isHostInRegex(domain, this.bannedHostsRegexps) &&
                            isHostInRegex(domain, this.allowedHostsRegexps)
                        );
                    });
                    const maxEntry = allowedEntries.reduce<[string | null, number]>(
                        (max, entry) => {
                            return entry[1] > max[1] ? entry : max;
                        },
                        [null, 0],
                    );
                    const [userId, powerLevel] = maxEntry;
                    // object wasn't empty, and max entry wasn't a demotion from the default
                    if (userId !== null && powerLevel >= 50) {
                        this.highestPlUserId = userId;
                        return;
                    }
                }
            }
        }
        this.highestPlUserId = null;
    }

    private updateAllowedServers(): void {
        const bannedHostsRegexps: RegExp[] = [];
        let allowedHostsRegexps = [ANY_REGEX]; // default allow everyone
        if (this.room?.currentState) {
            const aclEvent = this.room?.currentState.getStateEvents(EventType.RoomServerAcl, "");
            if (aclEvent && aclEvent.getContent()) {
                const getRegex = (hostname: string): RegExp => new RegExp("^" + utils.globToRegexp(hostname) + "$");

                const denied = aclEvent.getContent<{ deny: string[] }>().deny;
                if (Array.isArray(denied)) {
                    denied.forEach((h) => bannedHostsRegexps.push(getRegex(h)));
                }

                const allowed = aclEvent.getContent<{ allow: string[] }>().allow;
                allowedHostsRegexps = []; // we don't want to use the default rule here
                if (Array.isArray(denied)) {
                    allowed.forEach((h) => allowedHostsRegexps.push(getRegex(h)));
                }
            }
        }
        this.bannedHostsRegexps = bannedHostsRegexps;
        this.allowedHostsRegexps = allowedHostsRegexps;
    }

    private updatePopulationMap(): void {
        const populationMap: { [server: string]: number } = {};
        if (this.room) {
            for (const member of this.room.getJoinedMembers()) {
                const serverName = getServerName(member.userId);
                if (!populationMap[serverName]) {
                    populationMap[serverName] = 0;
                }
                populationMap[serverName]++;
            }
        }
        this.populationMap = populationMap;
    }

    private updateServerCandidates = (): void => {
        const candidates = new Set<string>();
        if (this.highestPlUserId) {
            candidates.add(getServerName(this.highestPlUserId));
        }

        const serversByPopulation = Object.keys(this.populationMap).sort(
            (a, b) => this.populationMap[b] - this.populationMap[a],
        );

        for (let i = 0; i < serversByPopulation.length && candidates.size < MAX_SERVER_CANDIDATES; i++) {
            const serverName = serversByPopulation[i];
            const domain = getHostnameFromMatrixServerName(serverName) ?? "";
            if (
                !candidates.has(serverName) &&
                !isHostnameIpAddress(domain) &&
                !isHostInRegex(domain, this.bannedHostsRegexps) &&
                isHostInRegex(domain, this.allowedHostsRegexps)
            ) {
                candidates.add(serverName);
            }
        }

        this._serverCandidates = [...candidates];
    };
}

/**
 * Creates a permalink for an Entity. If isPill is set it uses a spec-compliant
 * prefix for the permalink, instead of permalink_prefix
 * @param {string} entityId The entity to link to.
 * @param {boolean} isPill Link should be pillifyable.
 * @returns {string|null} The transformed permalink or null if unable.
 */
export function makeGenericPermalink(entityId: string, isPill = false): string {
    return getPermalinkConstructor(isPill).forEntity(entityId);
}

/**
 * Creates a permalink for a User. If isPill is set it uses a spec-compliant
 * prefix for the permalink, instead of permalink_prefix
 * @param {string} userId The user to link to.
 * @param {boolean} isPill Link should be pillifyable.
 * @returns {string|null} The transformed permalink or null if unable.
 */
export function makeUserPermalink(userId: string, isPill = false): string {
    return getPermalinkConstructor(isPill).forUser(userId);
}

/**
 * Creates a permalink for a room. If isPill is set it uses a spec-compliant
 * prefix for the permalink, instead of permalink_prefix
 * @param {MatrixClient} matrixClient The MatrixClient to use
 * @param {string} roomId The user to link to.
 * @param {boolean} isPill Link should be pillifyable.
 * @returns {string|null} The transformed permalink or null if unable.
 */
export function makeRoomPermalink(matrixClient: MatrixClient, roomId: string, isPill = false): string {
    if (!roomId) {
        throw new Error("can't permalink a falsy roomId");
    }

    // If the roomId isn't actually a room ID, don't try to list the servers.
    // Aliases are already routable, and don't need extra information.
    if (roomId[0] !== "!") return getPermalinkConstructor(isPill).forRoom(roomId, []);

    const room = matrixClient.getRoom(roomId);
    if (!room) {
        return getPermalinkConstructor(isPill).forRoom(roomId, []);
    }
    const permalinkCreator = new RoomPermalinkCreator(room);
    permalinkCreator.load();
    return permalinkCreator.forShareableRoom();
}

export function isPermalinkHost(host: string): boolean {
    // Always check if the permalink is a spec permalink (callers are likely to call
    // parsePermalink after this function).
    if (new MatrixToPermalinkConstructor().isPermalinkHost(host)) return true;
    return getPermalinkConstructor().isPermalinkHost(host);
}

/**
 * Transforms an entity (permalink, room alias, user ID, etc) into a local URL
 * if possible. If it is already a permalink (matrix.to) it gets returned
 * unchanged.
 * @param {string} entity The entity to transform.
 * @returns {string|null} The transformed permalink or null if unable.
 */
export function tryTransformEntityToPermalink(matrixClient: MatrixClient, entity: string): string | null {
    if (!entity) return null;

    // Check to see if it is a bare entity for starters
    if (entity[0] === "#" || entity[0] === "!") return makeRoomPermalink(matrixClient, entity);
    if (entity[0] === "@") return makeUserPermalink(entity);

    if (entity.slice(0, 7) === "matrix:") {
        try {
            const permalinkParts = parsePermalink(entity);
            if (permalinkParts) {
                if (permalinkParts.roomIdOrAlias) {
                    const eventIdPart = permalinkParts.eventId ? `/${permalinkParts.eventId}` : "";
                    let pl = matrixtoBaseUrl + `/#/${permalinkParts.roomIdOrAlias}${eventIdPart}`;
                    if (permalinkParts.viaServers?.length) {
                        pl += new MatrixToPermalinkConstructor().encodeServerCandidates(permalinkParts.viaServers);
                    }
                    return pl;
                } else if (permalinkParts.userId) {
                    return matrixtoBaseUrl + `/#/${permalinkParts.userId}`;
                }
            }
        } catch {}
    }

    return entity;
}

/**
 * Transforms a permalink (or possible permalink) into a local URL if possible. If
 * the given permalink is found to not be a permalink, it'll be returned unaltered.
 * @param {string} permalink The permalink to try and transform.
 * @returns {string} The transformed permalink or original URL if unable.
 */
export function tryTransformPermalinkToLocalHref(permalink: string): string {
    if (
        !permalink.startsWith("http:") &&
        !permalink.startsWith("https:") &&
        !permalink.startsWith("matrix:") &&
        !permalink.startsWith("vector:") // Element Desktop
    ) {
        return permalink;
    }

    try {
        const m = decodeURIComponent(permalink).match(ELEMENT_URL_PATTERN);
        if (m) {
            return m[1];
        }
    } catch {
        // Not a valid URI
        return permalink;
    }

    // A bit of a hack to convert permalinks of unknown origin to Element links
    try {
        const permalinkParts = parsePermalink(permalink);
        if (permalinkParts) {
            if (permalinkParts.roomIdOrAlias) {
                const eventIdPart = permalinkParts.eventId ? `/${permalinkParts.eventId}` : "";
                permalink = `#/room/${permalinkParts.roomIdOrAlias}${eventIdPart}`;
                if (permalinkParts.viaServers?.length) {
                    permalink += new MatrixToPermalinkConstructor().encodeServerCandidates(permalinkParts.viaServers);
                }
            } else if (permalinkParts.userId) {
                permalink = `#/user/${permalinkParts.userId}`;
            } // else not a valid permalink for our purposes - do not handle
        }
    } catch {
        // Not an href we need to care about
    }

    return permalink;
}

export function getPrimaryPermalinkEntity(permalink: string): string | null {
    try {
        let permalinkParts = parsePermalink(permalink);

        // If not a permalink, try the vector patterns.
        if (!permalinkParts) {
            const m = permalink.match(ELEMENT_URL_PATTERN);
            if (m) {
                // A bit of a hack, but it gets the job done
                const handler = new ElementPermalinkConstructor("http://localhost");
                const entityInfo = m[1].split("#").slice(1).join("#");
                permalinkParts = handler.parsePermalink(`http://localhost/#${entityInfo}`);
            }
        }

        if (!permalinkParts) return null; // not processable
        if (permalinkParts.userId) return permalinkParts.userId;
        if (permalinkParts.roomIdOrAlias) return permalinkParts.roomIdOrAlias;
    } catch {
        // no entity - not a permalink
    }

    return null;
}

/**
 * Returns the correct PermalinkConstructor based on permalink_prefix
 * and isPill
 * @param {boolean} isPill Should constructed links be pillifyable.
 * @returns {string|null} The transformed permalink or null if unable.
 */
function getPermalinkConstructor(isPill = false): PermalinkConstructor {
    const elementPrefix = SdkConfig.get("permalink_prefix");
    if (elementPrefix && elementPrefix !== matrixtoBaseUrl && !isPill) {
        return new ElementPermalinkConstructor(elementPrefix);
    }

    return new MatrixToPermalinkConstructor();
}

export function parsePermalink(fullUrl: string): PermalinkParts | null {
    try {
        const elementPrefix = SdkConfig.get("permalink_prefix");
        const decodedUrl = decodeURIComponent(fullUrl);
        if (new RegExp(matrixToBaseUrlPattern, "i").test(decodedUrl)) {
            return new MatrixToPermalinkConstructor().parsePermalink(decodedUrl);
        } else if (fullUrl.startsWith("matrix:")) {
            return new MatrixSchemePermalinkConstructor().parsePermalink(fullUrl);
        } else if (elementPrefix && fullUrl.startsWith(elementPrefix)) {
            return new ElementPermalinkConstructor(elementPrefix).parsePermalink(fullUrl);
        }
    } catch (e) {
        logger.error("Failed to parse permalink", e);
    }

    return null; // not a permalink we can handle
}

export function getServerName(userId: string): string {
    return userId.split(":").splice(1).join(":");
}

export function getHostnameFromMatrixServerName(serverName: string): string | null {
    if (!serverName) return null;
    try {
        return new URL(`https://${serverName}`).hostname;
    } catch (e) {
        console.error("Error encountered while extracting hostname from server name", e);
        return null;
    }
}

function isHostInRegex(hostname: string, regexps: RegExp[]): boolean {
    if (!hostname) return true; // assumed
    if (regexps.length > 0 && !regexps[0].test) throw new Error(regexps[0].toString());

    return regexps.some((h) => h.test(hostname));
}

function isHostnameIpAddress(hostname: string): boolean {
    if (!hostname) return false;

    // is-ip doesn't want IPv6 addresses surrounded by brackets, so
    // take them off.
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.substring(1, hostname.length - 1);
    }

    return isIp(hostname);
}

export const calculateRoomVia = (room: Room): string[] => {
    const permalinkCreator = new RoomPermalinkCreator(room);
    permalinkCreator.load();
    return permalinkCreator.serverCandidates ?? [];
};

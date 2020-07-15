/*
Copyright 2019 New Vector Ltd

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

import {MatrixClientPeg} from "../../MatrixClientPeg";
import isIp from "is-ip";
import * as utils from 'matrix-js-sdk/src/utils';
import SpecPermalinkConstructor, {baseUrl as matrixtoBaseUrl} from "./SpecPermalinkConstructor";
import PermalinkConstructor, {PermalinkParts} from "./PermalinkConstructor";
import RiotPermalinkConstructor from "./RiotPermalinkConstructor";
import matrixLinkify from "../../linkify-matrix";
import SdkConfig from "../../SdkConfig";

// The maximum number of servers to pick when working out which servers
// to add to permalinks. The servers are appended as ?via=example.org
const MAX_SERVER_CANDIDATES = 3;


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
    // We support being given a roomId as a fallback in the event the `room` object
    // doesn't exist or is not healthy for us to rely on. For example, loading a
    // permalink to a room which the MatrixClient doesn't know about.
    constructor(room, roomId = null) {
        this._room = room;
        this._roomId = room ? room.roomId : roomId;
        this._highestPlUserId = null;
        this._populationMap = null;
        this._bannedHostsRegexps = null;
        this._allowedHostsRegexps = null;
        this._serverCandidates = null;
        this._started = false;

        if (!this._roomId) {
            throw new Error("Failed to resolve a roomId for the permalink creator to use");
        }

        this.onMembership = this.onMembership.bind(this);
        this.onRoomState = this.onRoomState.bind(this);
    }

    load() {
        if (!this._room || !this._room.currentState) {
            // Under rare and unknown circumstances it is possible to have a room with no
            // currentState, at least potentially at the early stages of joining a room.
            // To avoid breaking everything, we'll just warn rather than throw as well as
            // not bother updating the various aspects of the share link.
            console.warn("Tried to load a permalink creator with no room state");
            return;
        }
        this._updateAllowedServers();
        this._updateHighestPlUser();
        this._updatePopulationMap();
        this._updateServerCandidates();
    }

    start() {
        this.load();
        this._room.on("RoomMember.membership", this.onMembership);
        this._room.on("RoomState.events", this.onRoomState);
        this._started = true;
    }

    stop() {
        this._room.removeListener("RoomMember.membership", this.onMembership);
        this._room.removeListener("RoomState.events", this.onRoomState);
        this._started = false;
    }

    isStarted() {
        return this._started;
    }

    forEvent(eventId) {
        return getPermalinkConstructor().forEvent(this._roomId, eventId, this._serverCandidates);
    }

    forRoom() {
        return getPermalinkConstructor().forRoom(this._roomId, this._serverCandidates);
    }

    onRoomState(event) {
        switch (event.getType()) {
            case "m.room.server_acl":
                this._updateAllowedServers();
                this._updateHighestPlUser();
                this._updatePopulationMap();
                this._updateServerCandidates();
                return;
            case "m.room.power_levels":
                this._updateHighestPlUser();
                this._updateServerCandidates();
                return;
        }
    }

    onMembership(evt, member, oldMembership) {
        const userId = member.userId;
        const membership = member.membership;
        const serverName = getServerName(userId);
        const hasJoined = oldMembership !== "join" && membership === "join";
        const hasLeft = oldMembership === "join" && membership !== "join";

        if (hasLeft) {
            this._populationMap[serverName]--;
        } else if (hasJoined) {
            this._populationMap[serverName]++;
        }

        this._updateHighestPlUser();
        this._updateServerCandidates();
    }

    _updateHighestPlUser() {
        const plEvent = this._room.currentState.getStateEvents("m.room.power_levels", "");
        if (plEvent) {
            const content = plEvent.getContent();
            if (content) {
                const users = content.users;
                if (users) {
                    const entries = Object.entries(users);
                    const allowedEntries = entries.filter(([userId]) => {
                        const member = this._room.getMember(userId);
                        if (!member || member.membership !== "join") {
                            return false;
                        }
                        const serverName = getServerName(userId);
                        return !isHostnameIpAddress(serverName) &&
                            !isHostInRegex(serverName, this._bannedHostsRegexps) &&
                            isHostInRegex(serverName, this._allowedHostsRegexps);
                    });
                    const maxEntry = allowedEntries.reduce((max, entry) => {
                        return (entry[1] > max[1]) ? entry : max;
                    }, [null, 0]);
                    const [userId, powerLevel] = maxEntry;
                    // object wasn't empty, and max entry wasn't a demotion from the default
                    if (userId !== null && powerLevel >= 50) {
                        this._highestPlUserId = userId;
                        return;
                    }
                }
            }
        }
        this._highestPlUserId = null;
    }

    _updateAllowedServers() {
        const bannedHostsRegexps = [];
        let allowedHostsRegexps = [new RegExp(".*")]; // default allow everyone
        if (this._room.currentState) {
            const aclEvent = this._room.currentState.getStateEvents("m.room.server_acl", "");
            if (aclEvent && aclEvent.getContent()) {
                const getRegex = (hostname) => new RegExp("^" + utils.globToRegexp(hostname, false) + "$");

                const denied = aclEvent.getContent().deny || [];
                denied.forEach(h => bannedHostsRegexps.push(getRegex(h)));

                const allowed = aclEvent.getContent().allow || [];
                allowedHostsRegexps = []; // we don't want to use the default rule here
                allowed.forEach(h => allowedHostsRegexps.push(getRegex(h)));
            }
        }
        this._bannedHostsRegexps = bannedHostsRegexps;
        this._allowedHostsRegexps = allowedHostsRegexps;
    }

    _updatePopulationMap() {
        const populationMap: { [server: string]: number } = {};
        for (const member of this._room.getJoinedMembers()) {
            const serverName = getServerName(member.userId);
            if (!populationMap[serverName]) {
                populationMap[serverName] = 0;
            }
            populationMap[serverName]++;
        }
        this._populationMap = populationMap;
    }

    _updateServerCandidates() {
        let candidates = [];
        if (this._highestPlUserId) {
            candidates.push(getServerName(this._highestPlUserId));
        }

        const serversByPopulation = Object.keys(this._populationMap)
            .sort((a, b) => this._populationMap[b] - this._populationMap[a])
            .filter(a => {
                return !candidates.includes(a) &&
                    !isHostnameIpAddress(a) &&
                    !isHostInRegex(a, this._bannedHostsRegexps) &&
                    isHostInRegex(a, this._allowedHostsRegexps);
            });

        const remainingServers = serversByPopulation.slice(0, MAX_SERVER_CANDIDATES - candidates.length);
        candidates = candidates.concat(remainingServers);

        this._serverCandidates = candidates;
    }
}

export function makeGenericPermalink(entityId: string): string {
    return getPermalinkConstructor().forEntity(entityId);
}

export function makeUserPermalink(userId) {
    return getPermalinkConstructor().forUser(userId);
}

export function makeRoomPermalink(roomId) {
    if (!roomId) {
        throw new Error("can't permalink a falsey roomId");
    }

    // If the roomId isn't actually a room ID, don't try to list the servers.
    // Aliases are already routable, and don't need extra information.
    if (roomId[0] !== '!') return getPermalinkConstructor().forRoom(roomId, []);

    const client = MatrixClientPeg.get();
    const room = client.getRoom(roomId);
    if (!room) {
        return getPermalinkConstructor().forRoom(roomId, []);
    }
    const permalinkCreator = new RoomPermalinkCreator(room);
    permalinkCreator.load();
    return permalinkCreator.forRoom();
}

export function makeGroupPermalink(groupId) {
    return getPermalinkConstructor().forGroup(groupId);
}

export function isPermalinkHost(host: string): boolean {
    // Always check if the permalink is a spec permalink (callers are likely to call
    // parsePermalink after this function).
    if (new SpecPermalinkConstructor().isPermalinkHost(host)) return true;
    return getPermalinkConstructor().isPermalinkHost(host);
}

/**
 * Transforms an entity (permalink, room alias, user ID, etc) into a local URL
 * if possible. If the given entity is not found to be valid enough to be converted
 * then a null value will be returned.
 * @param {string} entity The entity to transform.
 * @returns {string|null} The transformed permalink or null if unable.
 */
export function tryTransformEntityToPermalink(entity: string): string {
    if (!entity) return null;

    // Check to see if it is a bare entity for starters
    if (entity[0] === '#' || entity[0] === '!') return makeRoomPermalink(entity);
    if (entity[0] === '@') return makeUserPermalink(entity);
    if (entity[0] === '+') return makeGroupPermalink(entity);

    // Then try and merge it into a permalink
    return tryTransformPermalinkToLocalHref(entity);
}

/**
 * Transforms a permalink (or possible permalink) into a local URL if possible. If
 * the given permalink is found to not be a permalink, it'll be returned unaltered.
 * @param {string} permalink The permalink to try and transform.
 * @returns {string} The transformed permalink or original URL if unable.
 */
export function tryTransformPermalinkToLocalHref(permalink: string): string {
    if (!permalink.startsWith("http:") && !permalink.startsWith("https:")) {
        return permalink;
    }

    const m = permalink.match(matrixLinkify.VECTOR_URL_PATTERN);
    if (m) {
        return m[1];
    }

    // A bit of a hack to convert permalinks of unknown origin to Riot links
    try {
        const permalinkParts = parsePermalink(permalink);
        if (permalinkParts) {
            if (permalinkParts.roomIdOrAlias) {
                const eventIdPart = permalinkParts.eventId ? `/${permalinkParts.eventId}` : '';
                permalink = `#/room/${permalinkParts.roomIdOrAlias}${eventIdPart}`;
            } else if (permalinkParts.groupId) {
                permalink = `#/group/${permalinkParts.groupId}`;
            } else if (permalinkParts.userId) {
                permalink = `#/user/${permalinkParts.userId}`;
            } // else not a valid permalink for our purposes - do not handle
        }
    } catch (e) {
        // Not an href we need to care about
    }

    return permalink;
}

export function getPrimaryPermalinkEntity(permalink: string): string {
    try {
        let permalinkParts = parsePermalink(permalink);

        // If not a permalink, try the vector patterns.
        if (!permalinkParts) {
            const m = permalink.match(matrixLinkify.VECTOR_URL_PATTERN);
            if (m) {
                // A bit of a hack, but it gets the job done
                const handler = new RiotPermalinkConstructor("http://localhost");
                const entityInfo = m[1].split('#').slice(1).join('#');
                permalinkParts = handler.parsePermalink(`http://localhost/#${entityInfo}`);
            }
        }

        if (!permalinkParts) return null; // not processable
        if (permalinkParts.userId) return permalinkParts.userId;
        if (permalinkParts.groupId) return permalinkParts.groupId;
        if (permalinkParts.roomIdOrAlias) return permalinkParts.roomIdOrAlias;
    } catch (e) {
        // no entity - not a permalink
    }

    return null;
}

function getPermalinkConstructor(): PermalinkConstructor {
    const riotPrefix = SdkConfig.get()['permalinkPrefix'];
    if (riotPrefix && riotPrefix !== matrixtoBaseUrl) {
        return new RiotPermalinkConstructor(riotPrefix);
    }

    return new SpecPermalinkConstructor();
}

export function parsePermalink(fullUrl: string): PermalinkParts {
    const riotPrefix = SdkConfig.get()['permalinkPrefix'];
    if (fullUrl.startsWith(matrixtoBaseUrl)) {
        return new SpecPermalinkConstructor().parsePermalink(fullUrl);
    } else if (riotPrefix && fullUrl.startsWith(riotPrefix)) {
        return new RiotPermalinkConstructor(riotPrefix).parsePermalink(fullUrl);
    }

    return null; // not a permalink we can handle
}

function getServerName(userId) {
    return userId.split(":").splice(1).join(":");
}

function getHostnameFromMatrixDomain(domain) {
    if (!domain) return null;
    return new URL(`https://${domain}`).hostname;
}

function isHostInRegex(hostname, regexps) {
    hostname = getHostnameFromMatrixDomain(hostname);
    if (!hostname) return true; // assumed
    if (regexps.length > 0 && !regexps[0].test) throw new Error(regexps[0]);

    return regexps.filter(h => h.test(hostname)).length > 0;
}

function isHostnameIpAddress(hostname) {
    hostname = getHostnameFromMatrixDomain(hostname);
    if (!hostname) return false;

    // is-ip doesn't want IPv6 addresses surrounded by brackets, so
    // take them off.
    if (hostname.startsWith("[") && hostname.endsWith("]")) {
        hostname = hostname.substring(1, hostname.length - 1);
    }

    return isIp(hostname);
}

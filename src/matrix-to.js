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

import MatrixClientPeg from "./MatrixClientPeg";
import isIp from "is-ip";
import utils from 'matrix-js-sdk/lib/utils';

export const host = "matrix.to";
export const baseUrl = `https://${host}`;

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
    constructor(room) {
        this._room = room;
        this._highestPlUserId = null;
        this._populationMap = null;
        this._bannedHostsRegexps = null;
        this._allowedHostsRegexps = null;
        this._serverCandidates = null;

        this.onMembership = this.onMembership.bind(this);
        this.onRoomState = this.onRoomState.bind(this);
    }

    load() {
        this._updateAllowedServers();
        this._updateHighestPlUser();
        this._updatePopulationMap();
        this._updateServerCandidates();
    }

    start() {
        this.load();
        this._room.on("RoomMember.membership", this.onMembership);
        this._room.on("RoomState.events", this.onRoomState);
    }

    stop() {
        this._room.removeListener("RoomMember.membership", this.onMembership);
        this._room.removeListener("RoomState.events", this.onRoomState);
    }

    forEvent(eventId) {
        const roomId = this._room.roomId;
        const permalinkBase = `${baseUrl}/#/${roomId}/${eventId}`;
        return `${permalinkBase}${encodeServerCandidates(this._serverCandidates)}`;
    }

    forRoom() {
        const roomId = this._room.roomId;
        const permalinkBase = `${baseUrl}/#/${roomId}`;
        return `${permalinkBase}${encodeServerCandidates(this._serverCandidates)}`;
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
        const populationMap: {[server:string]:number} = {};
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


export function makeUserPermalink(userId) {
    return `${baseUrl}/#/${userId}`;
}

export function makeRoomPermalink(roomId) {
    const permalinkBase = `${baseUrl}/#/${roomId}`;

    // If the roomId isn't actually a room ID, don't try to list the servers.
    // Aliases are already routable, and don't need extra information.
    if (roomId[0] !== '!') return permalinkBase;

    const client = MatrixClientPeg.get();
    const room = client.getRoom(roomId);
    if (!room) {
        return permalinkBase;
    }
    const permalinkCreator = new RoomPermalinkCreator(room);
    permalinkCreator.load();
    return permalinkCreator.forRoom();
}

export function makeGroupPermalink(groupId) {
    return `${baseUrl}/#/${groupId}`;
}

export function encodeServerCandidates(candidates) {
    if (!candidates || candidates.length === 0) return '';
    return `?via=${candidates.map(c => encodeURIComponent(c)).join("&via=")}`;
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

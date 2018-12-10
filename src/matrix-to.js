/*
Copyright 2017 New Vector Ltd

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

export function makeEventPermalink(roomId, eventId) {
    const permalinkBase = `${baseUrl}/#/${roomId}/${eventId}`;

    // If the roomId isn't actually a room ID, don't try to list the servers.
    // Aliases are already routable, and don't need extra information.
    if (roomId[0] !== '!') return permalinkBase;

    const serverCandidates = pickServerCandidates(roomId);
    return `${permalinkBase}${encodeServerCandidates(serverCandidates)}`;
}

export function makeUserPermalink(userId) {
    return `${baseUrl}/#/${userId}`;
}

export function makeRoomPermalink(roomId) {
    const permalinkBase = `${baseUrl}/#/${roomId}`;

    // If the roomId isn't actually a room ID, don't try to list the servers.
    // Aliases are already routable, and don't need extra information.
    if (roomId[0] !== '!') return permalinkBase;

    const serverCandidates = pickServerCandidates(roomId);
    return `${permalinkBase}${encodeServerCandidates(serverCandidates)}`;
}

export function makeGroupPermalink(groupId) {
    return `${baseUrl}/#/${groupId}`;
}

export function encodeServerCandidates(candidates) {
    if (!candidates || candidates.length === 0) return '';
    return `?via=${candidates.map(c => encodeURIComponent(c)).join("&via=")}`;
}

export function pickServerCandidates(roomId) {
    const client = MatrixClientPeg.get();
    const room = client.getRoom(roomId);
    if (!room) return [];

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

    const bannedHostsRegexps = [];
    let allowedHostsRegexps = [new RegExp(".*")]; // default allow everyone
    if (room.currentState) {
        const aclEvent = room.currentState.getStateEvents("m.room.server_acl", "");
        if (aclEvent && aclEvent.getContent()) {
            const getRegex = (hostname) => new RegExp("^" + utils.globToRegexp(hostname, false) + "$");

            const denied = aclEvent.getContent().deny || [];
            denied.forEach(h => bannedHostsRegexps.push(getRegex(h)));

            const allowed = aclEvent.getContent().allow || [];
            allowedHostsRegexps = []; // we don't want to use the default rule here
            allowed.forEach(h => allowedHostsRegexps.push(getRegex(h)));
        }
    }

    const populationMap: {[server:string]:number} = {};
    const highestPlUser = {userId: null, powerLevel: 0, serverName: null};

    for (const member of room.getJoinedMembers()) {
        const serverName = member.userId.split(":").splice(1).join(":");
        if (member.powerLevel > highestPlUser.powerLevel && !isHostnameIpAddress(serverName)
            && !isHostInRegex(serverName, bannedHostsRegexps) && isHostInRegex(serverName, allowedHostsRegexps)) {
            highestPlUser.userId = member.userId;
            highestPlUser.powerLevel = member.powerLevel;
            highestPlUser.serverName = serverName;
        }

        if (!populationMap[serverName]) populationMap[serverName] = 0;
        populationMap[serverName]++;
    }

    const candidates = [];
    if (highestPlUser.powerLevel >= 50) candidates.push(highestPlUser.serverName);

    const beforePopulation = candidates.length;
    const serversByPopulation = Object.keys(populationMap)
        .sort((a, b) => populationMap[b] - populationMap[a])
        .filter(a => !candidates.includes(a) && !isHostnameIpAddress(a)
            && !isHostInRegex(a, bannedHostsRegexps) && isHostInRegex(a, allowedHostsRegexps));
    for (let i = beforePopulation; i < MAX_SERVER_CANDIDATES; i++) {
        const idx = i - beforePopulation;
        if (idx >= serversByPopulation.length) break;
        candidates.push(serversByPopulation[idx]);
    }

    return candidates;
}

function getHostnameFromMatrixDomain(domain) {
    if (!domain) return null;

    // The hostname might have a port, so we convert it to a URL and
    // split out the real hostname.
    const parser = document.createElement('a');
    parser.href = "https://" + domain;
    return parser.hostname;
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

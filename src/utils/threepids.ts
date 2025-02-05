/*
Copyright 2024 New Vector Ltd.
Copyright 2023 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { DirectoryMember, type Member, ThreepidMember } from "./direct-messages";

/**
 * Tries to resolve the ThreepidMembers to DirectoryMembers.
 *
 * @param members - List of members to resolve
 * @returns {Promise<Member[]>} Same list with ThreepidMembers replaced by DirectoryMembers if succesfully resolved
 */
export const resolveThreePids = async (members: Member[], client: MatrixClient): Promise<Member[]> => {
    const threePidMembers = members.filter((m) => m instanceof ThreepidMember) as ThreepidMember[];

    // Nothing to do here
    if (threePidMembers.length === 0) return members;

    const lookedUpProfiles = await lookupThreePidProfiles(threePidMembers, client);

    return members.map((member: Member) => {
        if (!(member instanceof ThreepidMember)) return member;

        const lookedUpProfile = lookedUpProfiles.find((r) => r.threePidId === member.userId);

        // No profile found for this member; use the ThreepidMember.
        if (!lookedUpProfile) return member;

        return new DirectoryMember({
            user_id: lookedUpProfile.mxid,
            avatar_url: lookedUpProfile?.profile?.avatar_url,
            display_name: lookedUpProfile?.profile?.displayname,
        });
    });
};

/**
 * Tries to look up the ThreepidMembers.
 *
 * @param threePids - List of 3rd-party members to look up
 * @returns  List of resolved 3rd-party IDs with their MXIDs
 */
export const lookupThreePids = async (
    threePids: ThreepidMember[],
    client: MatrixClient,
): Promise<{ threePidId: string; mxid: string }[]> => {
    // No identity server configured. Unable to resolve any 3rd party member.
    if (!client.identityServer) return [];

    // Nothing we can search, return null
    if (threePids.length === 0) return [];

    const token = await client.identityServer.getAccessToken();

    if (!token) return [];

    const lookedUp = await client.bulkLookupThreePids(
        threePids.map((t) => [t.isEmail ? "email" : "msisdn", t.userId]),
        token,
    );

    return lookedUp.threepids.map(([_threePidType, threePidId, mxid]: [string, string, string]) => ({
        threePidId,
        mxid,
    }));
};

/**
 * Tries to look up the MXIDs and profiles of the ThreepidMembers.
 *
 * @param threePids - List of 3rd-prty members to look up
 * @returns List of resolved 3rd-party members with their MXIDs and profile (if found)
 */
export const lookupThreePidProfiles = async (
    threePids: ThreepidMember[],
    client: MatrixClient,
): Promise<{ threePidId: string; mxid: string; profile: null | { avatar_url?: string; displayname?: string } }[]> => {
    const lookedUpThreePids = await lookupThreePids(threePids, client);
    const promises = lookedUpThreePids.map(async (t) => {
        let profile: null | { avatar_url?: string; display_name?: string } = null;

        try {
            profile = await client.getProfileInfo(t.mxid);
        } catch {
            // ignore any lookup error
        }

        return {
            threePidId: t.threePidId,
            mxid: t.mxid,
            profile,
        };
    });
    return Promise.all(promises);
};

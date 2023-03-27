/*
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

import { logger } from "matrix-js-sdk/src/logger";
import { IMatrixProfile, MatrixClient, MatrixEvent, RoomMember, RoomMemberEvent } from "matrix-js-sdk/src/matrix";

import { LruCache } from "../utils/LruCache";

const cacheSize = 500;

type StoreProfileValue = IMatrixProfile | undefined | null;

/**
 * This store provides cached access to user profiles.
 * Listens for membership events and invalidates the cache for a profile on update with different profile values.
 */
export class UserProfilesStore {
    private profiles = new LruCache<string, IMatrixProfile | null>(cacheSize);
    private knownProfiles = new LruCache<string, IMatrixProfile | null>(cacheSize);

    public constructor(private client: MatrixClient) {
        client.on(RoomMemberEvent.Membership, this.onRoomMembershipEvent);
    }

    /**
     * Synchronously get a profile from the store cache.
     *
     * @param userId - User Id of the profile to fetch
     * @returns The profile, if cached by the store.
     *          Null if the profile does not exist.
     *          Undefined if the profile is not cached by the store.
     *          In this case a profile can be fetched from the API via {@link fetchProfile}.
     */
    public getProfile(userId: string): StoreProfileValue {
        return this.profiles.get(userId);
    }

    /**
     * Synchronously get a profile from known users from the store cache.
     * Known user means that at least one shared room with the user exists.
     *
     * @param userId - User Id of the profile to fetch
     * @returns The profile, if cached by the store.
     *          Null if the profile does not exist.
     *          Undefined if the profile is not cached by the store.
     *          In this case a profile can be fetched from the API via {@link fetchOnlyKnownProfile}.
     */
    public getOnlyKnownProfile(userId: string): StoreProfileValue {
        return this.knownProfiles.get(userId);
    }

    /**
     * Asynchronousely fetches a profile from the API.
     * Stores the result in the cache, so that next time {@link getProfile} returns this value.
     *
     * @param userId - User Id for which the profile should be fetched for
     * @returns The profile, if found.
     *          Null if the profile does not exist or there was an error fetching it.
     */
    public async fetchProfile(userId: string): Promise<IMatrixProfile | null> {
        const profile = await this.fetchProfileFromApi(userId);
        this.profiles.set(userId, profile);
        return profile;
    }

    /**
     * Asynchronousely fetches a profile from a known user from the API.
     * Known user means that at least one shared room with the user exists.
     * Stores the result in the cache, so that next time {@link getOnlyKnownProfile} returns this value.
     *
     * @param userId - User Id for which the profile should be fetched for
     * @returns The profile, if found.
     *          Undefined if the user is unknown.
     *          Null if the profile does not exist or there was an error fetching it.
     */
    public async fetchOnlyKnownProfile(userId: string): Promise<StoreProfileValue> {
        // Do not look up unknown users. The test for existence in knownProfiles is a performance optimisation.
        // If the user Id exists in knownProfiles we know them.
        if (!this.knownProfiles.has(userId) && !this.isUserIdKnown(userId)) return undefined;

        const profile = await this.fetchProfileFromApi(userId);
        this.knownProfiles.set(userId, profile);
        return profile;
    }

    /**
     * Looks up a user profile via API.
     *
     * @param userId - User Id for which the profile should be fetched for
     * @returns The profile information or null on errors
     */
    private async fetchProfileFromApi(userId: string): Promise<IMatrixProfile | null> {
        try {
            return (await this.client.getProfileInfo(userId)) ?? null;
        } catch (e) {
            logger.warn(`Error retrieving profile for userId ${userId}`, e);
        }

        return null;
    }

    /**
     * Whether at least one shared room with the userId exists.
     *
     * @param userId
     * @returns true: at least one room shared with user identified by its Id, else false.
     */
    private isUserIdKnown(userId: string): boolean {
        return this.client.getRooms().some((room) => {
            return !!room.getMember(userId);
        });
    }

    /**
     * Simple cache invalidation if a room membership event is received and
     * at least one profile value differs from the cached one.
     */
    private onRoomMembershipEvent = (event: MatrixEvent, member: RoomMember): void => {
        const profile = this.profiles.get(member.userId);

        if (
            profile &&
            (profile.displayname !== member.rawDisplayName || profile.avatar_url !== member.getMxcAvatarUrl())
        ) {
            this.profiles.delete(member.userId);
        }

        const knownProfile = this.knownProfiles.get(member.userId);

        if (
            knownProfile &&
            (knownProfile.displayname !== member.rawDisplayName || knownProfile.avatar_url !== member.getMxcAvatarUrl())
        ) {
            this.knownProfiles.delete(member.userId);
        }
    };
}

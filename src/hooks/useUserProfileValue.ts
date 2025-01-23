/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { useEffect, useState } from "react";
import { MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";
import { SdkContextClass } from "../contexts/SDKContext";
import { UserProfilesStoreEvents } from "../stores/UserProfilesStore";
import { useTypedEventEmitter } from "./useEventEmitter";
/**
 * Fetch a key from a user's extended profile, and regularly refetch at a
 * given interval.
 *
 * @param cli The Matrix Client instance.
 * @param key The key to fetch.
 * @param userId The user who's profile we're interested in.
 * @param ignoreCache Ignore the cache on first load.
 * @returns The value from the profile, or null if not set.
 */
export const useUserProfileValue = (cli: MatrixClient, key: string, userId?: string, ignoreCache?: boolean): string|null => {
    const [currentValue, setProfileValue] = useState<string|null>(null);
    const profilesStore = SdkContextClass.instance.userProfilesStore;

    useEffect(() => {
        if (!userId) {
            return;
        }
        profilesStore.subscribeToProfile(userId);
        return () => profilesStore.unsubscribeToProfile(userId);
    }, [userId]);

    useTypedEventEmitter(profilesStore, UserProfilesStoreEvents.ProfileUpdated, (updatedUserId, updatedProfile) => {
        if (userId !== updatedUserId) {
            return;
        }
        const value = (updatedProfile as any)?.[key];
        if (!value) {
            return;
        }
        if (typeof value !== "string") {
            // Err, definitely not a tz.
            throw Error("Profile value was not a string");
        }
        setProfileValue(value);
    });

    useEffect(() => {
        if (!userId) {
            return;
        }
        (async () => {
            try {
                const profile = await (ignoreCache ? profilesStore.fetchProfile(userId) : profilesStore.getOrFetchProfile(userId));
                // TODO: Types.
                const value = (profile as any)?.[key];
                if (!value) {
                    return;
                }
                if (typeof value !== "string") {
                    // Err, definitely not a tz.
                    throw Error("Profile value was not a string");
                }
                setProfileValue(value);
            } catch (ex) {
                if (ex instanceof MatrixError && ex.errcode === "M_NOT_FOUND") {
                    // No timezone set, ignore.
                    setProfileValue(null);
                    return;
                }
            }
        })();
    }, [userId, key, cli]);

    return currentValue;
};

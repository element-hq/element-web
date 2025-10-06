/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { useEffect, useState } from "react";
import {
    type MatrixClient,
    MatrixError,
    ProfileKeyMSC4175Timezone,
    ProfileKeyTimezone,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { getTwelveHourOptions } from "../DateUtils.ts";
import { useSettingValue } from "./useSettings.ts";

const log = logger.getChild("useUserTimezone");

/**
 * Fetch a user's delclared timezone through their profile, and return
 * a friendly string of the current time for that user. This will keep
 * in sync with the current time, and will be refreshed once a minute.
 *
 * @param cli The Matrix Client instance.
 * @param userId The userID to fetch the timezone for.
 * @returns A timezone name and friendly string for the user's timezone, or
 *          null if the user has no timezone or the timezone was not recognised
 *          by the browser.
 */
export const useUserTimezone = (cli: MatrixClient, userId: string): { timezone: string; friendly: string } | null => {
    const [timezone, setTimezone] = useState<string>();
    const [updateInterval, setUpdateInterval] = useState<ReturnType<typeof setTimeout>>();
    const [friendly, setFriendly] = useState<string>();
    const [supported, setSupported] = useState<boolean>();
    const showTwelveHour = useSettingValue("showTwelveHourTimestamps");

    useEffect(() => {
        if (!cli || supported !== undefined) {
            return;
        }
        cli.doesServerSupportExtendedProfiles()
            .then(setSupported)
            .catch((ex) => {
                console.warn("Unable to determine if extended profiles are supported", ex);
            });
    }, [supported, cli]);

    useEffect(() => {
        return () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        };
    }, [updateInterval]);

    useEffect(() => {
        if (supported !== true) {
            return;
        }
        (async () => {
            log.debug("Trying to fetch TZ for", userId);
            try {
                const userProfile = await cli.getExtendedProfile(userId);
                // In a future spec release, remove support for legacy key.
                const tz = userProfile[ProfileKeyTimezone] ?? userProfile[ProfileKeyMSC4175Timezone];
                if (typeof tz !== "string") {
                    // Definitely not a tz.
                    throw Error("Timezone value was not a string");
                }
                // This will validate the timezone for us.
                // eslint-disable-next-line new-cap
                Intl.DateTimeFormat(undefined, { timeZone: tz });

                const updateTime = (): void => {
                    const currentTime = new Date();
                    const friendly = currentTime.toLocaleString(undefined, {
                        ...getTwelveHourOptions(showTwelveHour),
                        timeZone: tz,
                        hour: "2-digit",
                        minute: "2-digit",
                        timeZoneName: "shortOffset",
                    });
                    setTimezone(tz);
                    setFriendly(friendly);
                    setUpdateInterval(setTimeout(updateTime, (60 - currentTime.getSeconds()) * 1000));
                };
                updateTime();
            } catch (ex) {
                setTimezone(undefined);
                setFriendly(undefined);
                setUpdateInterval(undefined);
                if (ex instanceof MatrixError && ex.errcode === "M_NOT_FOUND") {
                    // No timezone set, ignore.
                    return;
                }
                log.warn(`Could not render current timezone for ${userId}`, ex);
            }
        })();
    }, [supported, userId, cli, showTwelveHour]);

    if (!timezone || !friendly) {
        return null;
    }

    return {
        friendly,
        timezone,
    };
};

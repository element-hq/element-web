/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/
import { useEffect, useState } from "react";
import { type MatrixClient, MatrixError } from "matrix-js-sdk/src/matrix";

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
            console.log("Trying to fetch TZ");
            try {
                const tz = await cli.getExtendedProfileProperty(userId, "us.cloke.msc4175.tz");
                if (typeof tz !== "string") {
                    // Err, definitely not a tz.
                    throw Error("Timezone value was not a string");
                }
                // This will validate the timezone for us.
                // eslint-disable-next-line new-cap
                Intl.DateTimeFormat(undefined, { timeZone: tz });

                const updateTime = (): void => {
                    const currentTime = new Date();
                    const friendly = currentTime.toLocaleString(undefined, {
                        timeZone: tz,
                        hour12: true,
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
                console.error("Could not render current timezone for user", ex);
            }
        })();
    }, [supported, userId, cli]);

    if (!timezone || !friendly) {
        return null;
    }

    return {
        friendly,
        timezone,
    };
};

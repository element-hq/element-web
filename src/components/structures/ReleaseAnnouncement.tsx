/*
 * Copyright 2024 New Vector Ltd.
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import React, { type ComponentProps, type JSX, type PropsWithChildren } from "react";
import { ReleaseAnnouncement as ReleaseAnnouncementCompound } from "@vector-im/compound-web";

import { ReleaseAnnouncementStore, type Feature } from "../../stores/ReleaseAnnouncementStore";
import { useIsReleaseAnnouncementOpen } from "../../hooks/useIsReleaseAnnouncementOpen";

interface ReleaseAnnouncementProps
    extends Omit<ComponentProps<typeof ReleaseAnnouncementCompound>, "open" | "onClick"> {
    feature: Feature;
}

/**
 * Display a release announcement component around the children
 * Wrapper gluing the release announcement compound and the ReleaseAnnouncementStore
 * @param feature - the feature to announce, should be listed in {@link Feature}
 * @param children
 * @param props
 * @constructor
 */
export function ReleaseAnnouncement({
    feature,
    children,
    ...props
}: PropsWithChildren<ReleaseAnnouncementProps>): JSX.Element {
    const enabled = useIsReleaseAnnouncementOpen(feature);

    return (
        <ReleaseAnnouncementCompound
            open={enabled}
            onClick={() => ReleaseAnnouncementStore.instance.nextReleaseAnnouncement()}
            {...props}
        >
            {children}
        </ReleaseAnnouncementCompound>
    );
}

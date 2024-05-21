/*
 *
 * Copyright 2024 The Matrix.org Foundation C.I.C.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * /
 */

import React, { ComponentProps, JSX, PropsWithChildren } from "react";
import { ReleaseAnnouncement as ReleaseAnnouncementCompound } from "@vector-im/compound-web";

import { ReleaseAnnouncementStore, Feature } from "../../stores/ReleaseAnnouncementStore";
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

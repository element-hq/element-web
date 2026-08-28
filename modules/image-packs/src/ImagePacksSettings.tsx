/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { useInsertionEffect } from "react";

import { PackListPanel } from "./PackListPanel.tsx";
import { ensureImagePacksStyles } from "./style.ts";
import { DiscoveryPanel } from "./DiscoveryPanel.tsx";
import type { UseImagePacksResult } from "./useImagePacks.ts";

export interface ImagePacksSettingsProps {
    api: UseImagePacksResult;
    /** When provided, only this room's packs are shown and discovery installs target it. */
    roomId?: string;
    /** Hide the personal/global tab. */
    hideUserSection?: boolean;
    /** Hide the discovery section (e.g. when surfacing inside room settings). */
    hideDiscovery?: boolean;
}

/**
 * Image packs tab/section body. Used both for the User Settings tab and the
 * Room Settings section — pass `roomId` for the latter.
 */
export function ImagePacksSettings(props: ImagePacksSettingsProps): React.ReactElement {
    const { api, roomId, hideUserSection, hideDiscovery } = props;
    useInsertionEffect(() => {
        ensureImagePacksStyles();
    }, []);

    const userPacks = api.packs.filter((pack) => pack.scope === "user");
    const roomPacks = roomId ? api.packs.filter((pack) => pack.roomId === roomId && pack.scope !== "user") : [];

    return (
        <div data-testid="image-packs-tab" className="mx_ImagePacksTab">
            {!hideUserSection ? (
                <section className="mx_ImagePacksSection" aria-labelledby="image-packs-account-heading">
                    <div className="mx_ImagePacksSection_heading">
                        <div>
                            <span className="mx_ImagePacksEyebrow">Account library</span>
                            <h3 id="image-packs-account-heading">Personal &amp; global packs</h3>
                            <p>Keep one personal pack for your own emotes. Global packs follow you into every room.</p>
                        </div>
                        <span className="mx_ImagePacksCount">
                            {userPacks.length} {userPacks.length === 1 ? "pack" : "packs"}
                        </span>
                    </div>
                    <PackListPanel api={api} showGlobalToggle onlyUserScope allowCreateUserPack />
                </section>
            ) : null}
            {roomId ? (
                <section className="mx_ImagePacksSection" aria-labelledby="image-packs-room-heading">
                    <div className="mx_ImagePacksSection_heading">
                        <div>
                            <span className="mx_ImagePacksEyebrow">This room</span>
                            <h3 id="image-packs-room-heading">Room packs</h3>
                            <p>Shape the shared emoji shelf for everyone in this conversation.</p>
                        </div>
                        <span className="mx_ImagePacksCount">
                            {roomPacks.length} {roomPacks.length === 1 ? "pack" : "packs"}
                        </span>
                    </div>
                    <PackListPanel api={api} restrictToRoomId={roomId} hideUserScope allowCreateRoomPack />
                </section>
            ) : null}
            {hideDiscovery || !roomId ? null : (
                <section className="mx_ImagePacksSection" aria-labelledby="image-packs-discovery-heading">
                    <div className="mx_ImagePacksSection_heading">
                        <div>
                            <span className="mx_ImagePacksEyebrow">Find something new</span>
                            <h3 id="image-packs-discovery-heading">Image-pack discovery sources</h3>
                            <p>Save trusted directories and browse their packs when you want a fresh look.</p>
                        </div>
                        <span className="mx_ImagePacksCount">
                            {api.sources.length} {api.sources.length === 1 ? "source" : "sources"}
                        </span>
                    </div>
                    <DiscoveryPanel api={api} installRoomId={roomId} />
                </section>
            )}
        </div>
    );
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixEvent,
    RoomStateEvent,
    MatrixError,
    type User,
    UserEvent,
    EventType,
} from "matrix-js-sdk/src/matrix";
import { throttle } from "lodash";

import { type ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { _t } from "../languageHandler";
import { mediaFromMxc } from "../customisations/Media";

interface IState {
    displayName?: string;
    avatarUrl?: string;
    fetchedAt?: number;
}

const KEY_DISPLAY_NAME = "mx_profile_displayname";
const KEY_AVATAR_URL = "mx_profile_avatar_url";

export class OwnProfileStore extends AsyncStoreWithClient<IState> {
    private static readonly internalInstance = (() => {
        const instance = new OwnProfileStore();
        instance.start();
        return instance;
    })();

    private monitoredUser: User | null = null;

    public constructor() {
        // seed from localstorage because otherwise we won't get these values until a whole network
        // round-trip after the client is ready, and we often load widgets in that time, and we'd
        // and up passing them an incorrect display name
        super(defaultDispatcher, {
            displayName: window.localStorage.getItem(KEY_DISPLAY_NAME) || undefined,
            avatarUrl: window.localStorage.getItem(KEY_AVATAR_URL) || undefined,
        });
    }

    public static get instance(): OwnProfileStore {
        return OwnProfileStore.internalInstance;
    }

    /**
     * Gets the display name for the user, or null if not present.
     */
    public get displayName(): string | null {
        if (!this.matrixClient) return this.state.displayName || null;

        if (this.matrixClient.isGuest()) {
            return _t("common|guest");
        } else if (this.state.displayName) {
            return this.state.displayName;
        } else {
            return this.matrixClient.getUserId();
        }
    }

    public get isProfileInfoFetched(): boolean {
        return !!this.state.fetchedAt;
    }

    /**
     * Gets the MXC URI of the user's avatar, or null if not present.
     */
    public get avatarMxc(): string | null {
        return this.state.avatarUrl || null;
    }

    /**
     * Gets the user's avatar as an HTTP URL of the given size. If the user's
     * avatar is not present, this returns null.
     * @param size The size of the avatar. If zero, a full res copy of the avatar
     * will be returned as an HTTP URL.
     * @returns The HTTP URL of the user's avatar
     */
    public getHttpAvatarUrl(size = 0): string | null {
        if (!this.avatarMxc) return null;
        const media = mediaFromMxc(this.avatarMxc);
        if (!size || size <= 0) {
            return media.srcHttp;
        } else {
            return media.getSquareThumbnailHttp(size);
        }
    }

    protected async onNotReady(): Promise<void> {
        this.onProfileUpdate.cancel();
        if (this.monitoredUser) {
            this.monitoredUser.removeListener(UserEvent.DisplayName, this.onProfileUpdate);
            this.monitoredUser.removeListener(UserEvent.AvatarUrl, this.onProfileUpdate);
        }
        this.matrixClient?.removeListener(RoomStateEvent.Events, this.onStateEvents);
        await this.reset({});
    }

    protected async onReady(): Promise<void> {
        if (!this.matrixClient) return;
        const myUserId = this.matrixClient.getSafeUserId();
        this.monitoredUser = this.matrixClient.getUser(myUserId);
        if (this.monitoredUser) {
            this.monitoredUser.on(UserEvent.DisplayName, this.onProfileUpdate);
            this.monitoredUser.on(UserEvent.AvatarUrl, this.onProfileUpdate);
        }

        // We also have to listen for membership events for ourselves as the above User events
        // are fired only with presence, which matrix.org (and many others) has disabled.
        this.matrixClient.on(RoomStateEvent.Events, this.onStateEvents);

        await this.onProfileUpdate(); // trigger an initial update
    }

    protected async onAction(payload: ActionPayload): Promise<void> {
        // we don't actually do anything here
    }

    private onProfileUpdate = throttle(
        async (): Promise<void> => {
            if (!this.matrixClient) return;
            // We specifically do not use the User object we stored for profile info as it
            // could easily be wrong (such as per-room instead of global profile).

            let profileInfo: { displayname?: string; avatar_url?: string } = {
                displayname: undefined,
                avatar_url: undefined,
            };

            try {
                profileInfo = await this.matrixClient.getProfileInfo(this.matrixClient.getSafeUserId());
            } catch (error: unknown) {
                if (!(error instanceof MatrixError) || error.errcode !== "M_NOT_FOUND") {
                    /**
                     * Raise any other error than M_NOT_FOUND.
                     * M_NOT_FOUND could occur if there is no user profile.
                     * {@link https://spec.matrix.org/v1.7/client-server-api/#get_matrixclientv3profileuserid}
                     * We should then assume an empty profile, emit UPDATE_EVENT etc..
                     */
                    throw error;
                }
            }

            if (profileInfo.displayname) {
                window.localStorage.setItem(KEY_DISPLAY_NAME, profileInfo.displayname);
            } else {
                window.localStorage.removeItem(KEY_DISPLAY_NAME);
            }

            if (profileInfo.avatar_url) {
                window.localStorage.setItem(KEY_AVATAR_URL, profileInfo.avatar_url);
            } else {
                window.localStorage.removeItem(KEY_AVATAR_URL);
            }

            await this.updateState({
                displayName: profileInfo.displayname,
                avatarUrl: profileInfo.avatar_url,
                fetchedAt: Date.now(),
            });
        },
        200,
        { trailing: true, leading: true },
    );

    private onStateEvents = async (ev: MatrixEvent): Promise<void> => {
        const myUserId = MatrixClientPeg.safeGet().getUserId();
        if (ev.getType() === EventType.RoomMember && ev.getSender() === myUserId && ev.getStateKey() === myUserId) {
            await this.onProfileUpdate();
        }
    };
}

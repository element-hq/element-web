/*
Copyright 2020 The Matrix.org Foundation C.I.C.

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

import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { User, UserEvent } from "matrix-js-sdk/src/models/user";
import { RoomStateEvent } from "matrix-js-sdk/src/models/room-state";
import { throttle } from "lodash";
import { EventType } from "matrix-js-sdk/src/@types/event";

import { ActionPayload } from "../dispatcher/payloads";
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

    private constructor() {
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
            return _t("Guest");
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
            const profileInfo = await this.matrixClient.getProfileInfo(this.matrixClient.getSafeUserId());
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
        const myUserId = MatrixClientPeg.get().getUserId();
        if (ev.getType() === EventType.RoomMember && ev.getSender() === myUserId && ev.getStateKey() === myUserId) {
            await this.onProfileUpdate();
        }
    };
}

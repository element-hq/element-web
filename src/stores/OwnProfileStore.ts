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

import { ActionPayload } from "../dispatcher/payloads";
import { AsyncStoreWithClient } from "./AsyncStoreWithClient";
import defaultDispatcher from "../dispatcher/dispatcher";
import { MatrixEvent } from "matrix-js-sdk/src/models/event";
import { User } from "matrix-js-sdk/src/models/user";
import { throttle } from "lodash";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { _t } from "../languageHandler";

interface IState {
    displayName?: string;
    avatarUrl?: string;
}

export class OwnProfileStore extends AsyncStoreWithClient<IState> {
    private static internalInstance = new OwnProfileStore();

    private monitoredUser: User;

    private constructor() {
        super(defaultDispatcher, {});
    }

    public static get instance(): OwnProfileStore {
        return OwnProfileStore.internalInstance;
    }

    /**
     * Gets the display name for the user, or null if not present.
     */
    public get displayName(): string {
        if (!this.matrixClient) return this.state.displayName || null;

        if (this.matrixClient.isGuest()) {
            return _t("Guest");
        } else if (this.state.displayName) {
            return this.state.displayName;
        } else {
            return this.matrixClient.getUserId();
        }
    }

    /**
     * Gets the MXC URI of the user's avatar, or null if not present.
     */
    public get avatarMxc(): string {
        return this.state.avatarUrl || null;
    }

    /**
     * Gets the user's avatar as an HTTP URL of the given size. If the user's
     * avatar is not present, this returns null.
     * @param size The size of the avatar
     * @returns The HTTP URL of the user's avatar
     */
    public getHttpAvatarUrl(size: number): string {
        if (!this.avatarMxc) return null;
        return this.matrixClient.mxcUrlToHttp(this.avatarMxc, size, size);
    }

    protected async onNotReady() {
        if (this.monitoredUser) {
            this.monitoredUser.removeListener("User.displayName", this.onProfileUpdate);
            this.monitoredUser.removeListener("User.avatarUrl", this.onProfileUpdate);
        }
        if (this.matrixClient) {
            this.matrixClient.removeListener("RoomState.events", this.onStateEvents);
        }
        await this.reset({});
    }

    protected async onReady() {
        const myUserId = this.matrixClient.getUserId();
        this.monitoredUser = this.matrixClient.getUser(myUserId);
        if (this.monitoredUser) {
            this.monitoredUser.on("User.displayName", this.onProfileUpdate);
            this.monitoredUser.on("User.avatarUrl", this.onProfileUpdate);
        }

        // We also have to listen for membership events for ourselves as the above User events
        // are fired only with presence, which matrix.org (and many others) has disabled.
        this.matrixClient.on("RoomState.events", this.onStateEvents);

        await this.onProfileUpdate(); // trigger an initial update
    }

    protected async onAction(payload: ActionPayload) {
        // we don't actually do anything here
    }

    private onProfileUpdate = async () => {
        // We specifically do not use the User object we stored for profile info as it
        // could easily be wrong (such as per-room instead of global profile).
        const profileInfo = await this.matrixClient.getProfileInfo(this.matrixClient.getUserId());
        await this.updateState({displayName: profileInfo.displayname, avatarUrl: profileInfo.avatar_url});
    };

    // TSLint wants this to be a member, but we don't want that.
    // tslint:disable-next-line
    private onStateEvents = throttle(async (ev: MatrixEvent) => {
        const myUserId = MatrixClientPeg.get().getUserId();
        if (ev.getType() === 'm.room.member' && ev.getSender() === myUserId && ev.getStateKey() === myUserId) {
            await this.onProfileUpdate();
        }
    }, 200, {trailing: true, leading: true});
}

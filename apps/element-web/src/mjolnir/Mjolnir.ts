/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { type MatrixEvent, RoomStateEvent, Preset } from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import { MatrixClientPeg } from "../MatrixClientPeg";
import { ALL_RULE_TYPES, BanList } from "./BanList";
import SettingsStore from "../settings/SettingsStore";
import { _t } from "../languageHandler";
import dis from "../dispatcher/dispatcher";
import { SettingLevel } from "../settings/SettingLevel";
import { type ActionPayload } from "../dispatcher/payloads";
import { type DoAfterSyncPreparedPayload } from "../dispatcher/payloads/DoAfterSyncPreparedPayload";
import { Action } from "../dispatcher/actions";

// TODO: Move this and related files to the js-sdk or something once finalized.

export class Mjolnir {
    private static instance?: Mjolnir;

    private _lists: BanList[] = []; // eslint-disable-line @typescript-eslint/naming-convention
    private _roomIds: string[] = []; // eslint-disable-line @typescript-eslint/naming-convention
    private mjolnirWatchRef?: string;
    private dispatcherRef?: string;

    public get roomIds(): string[] {
        return this._roomIds;
    }

    public get lists(): BanList[] {
        return this._lists;
    }

    public start(): void {
        this.mjolnirWatchRef = SettingsStore.watchSetting("mjolnirRooms", null, this.onListsChanged.bind(this));

        this.dispatcherRef = dis.register(this.onAction);
        dis.dispatch<DoAfterSyncPreparedPayload<ActionPayload>>({
            action: Action.DoAfterSyncPrepared,
            deferred_action: { action: "setup_mjolnir" },
        });
    }

    private onAction = (payload: ActionPayload): void => {
        if (payload["action"] === "setup_mjolnir") {
            logger.log("Setting up Mjolnir: after sync");
            this.setup();
        }
    };

    public setup(): void {
        if (!MatrixClientPeg.get()) return;
        this.updateLists(SettingsStore.getValue("mjolnirRooms"));
        MatrixClientPeg.get()!.on(RoomStateEvent.Events, this.onEvent);
    }

    public stop(): void {
        SettingsStore.unwatchSetting(this.mjolnirWatchRef);
        this.mjolnirWatchRef = undefined;

        dis.unregister(this.dispatcherRef);
        this.dispatcherRef = undefined;

        MatrixClientPeg.get()?.removeListener(RoomStateEvent.Events, this.onEvent);
    }

    public async getOrCreatePersonalList(): Promise<BanList> {
        let personalRoomId = SettingsStore.getValue("mjolnirPersonalRoom");
        if (!personalRoomId) {
            const resp = await MatrixClientPeg.safeGet().createRoom({
                name: _t("labs_mjolnir|room_name"),
                topic: _t("labs_mjolnir|room_topic"),
                preset: Preset.PrivateChat,
            });
            personalRoomId = resp["room_id"];
            await SettingsStore.setValue("mjolnirPersonalRoom", null, SettingLevel.ACCOUNT, personalRoomId);
            await SettingsStore.setValue("mjolnirRooms", null, SettingLevel.ACCOUNT, [
                personalRoomId,
                ...this._roomIds,
            ]);
        }
        if (!personalRoomId) {
            throw new Error("Error finding a room ID to use");
        }

        let list = this._lists.find((b) => b.roomId === personalRoomId);
        if (!list) list = new BanList(personalRoomId);
        // we don't append the list to the tracked rooms because it should already be there.
        // we're just trying to get the caller some utility access to the list

        return list;
    }

    // get without creating the list
    public getPersonalList(): BanList | null {
        const personalRoomId = SettingsStore.getValue("mjolnirPersonalRoom");
        if (!personalRoomId) return null;

        let list = this._lists.find((b) => b.roomId === personalRoomId);
        if (!list) list = new BanList(personalRoomId);
        // we don't append the list to the tracked rooms because it should already be there.
        // we're just trying to get the caller some utility access to the list

        return list;
    }

    public async subscribeToList(roomId: string): Promise<void> {
        const roomIds = [...this._roomIds, roomId];
        await SettingsStore.setValue("mjolnirRooms", null, SettingLevel.ACCOUNT, roomIds);
        this._lists.push(new BanList(roomId));
    }

    public async unsubscribeFromList(roomId: string): Promise<void> {
        const roomIds = this._roomIds.filter((r) => r !== roomId);
        await SettingsStore.setValue("mjolnirRooms", null, SettingLevel.ACCOUNT, roomIds);
        this._lists = this._lists.filter((b) => b.roomId !== roomId);
    }

    private onEvent = (event: MatrixEvent): void => {
        if (!MatrixClientPeg.get()) return;
        if (!this._roomIds.includes(event.getRoomId()!)) return;
        if (!ALL_RULE_TYPES.includes(event.getType())) return;

        this.updateLists(this._roomIds);
    };

    private onListsChanged(
        settingName: string,
        roomId: string | null,
        atLevel: SettingLevel,
        newValue: string[],
    ): void {
        // We know that ban lists are only recorded at one level so we don't need to re-eval them
        this.updateLists(newValue);
    }

    private updateLists(listRoomIds: string[]): void {
        if (!MatrixClientPeg.get()) return;

        logger.log("Updating Mjolnir ban lists to: " + listRoomIds);
        this._lists = [];
        this._roomIds = listRoomIds || [];
        if (!listRoomIds) return;

        for (const roomId of listRoomIds) {
            // Creating the list updates it
            this._lists.push(new BanList(roomId));
        }
    }

    public isServerBanned(serverName: string): boolean {
        for (const list of this._lists) {
            for (const rule of list.serverRules) {
                if (rule.isMatch(serverName)) {
                    return true;
                }
            }
        }
        return false;
    }

    public isUserBanned(userId: string): boolean {
        for (const list of this._lists) {
            for (const rule of list.userRules) {
                if (rule.isMatch(userId)) {
                    return true;
                }
            }
        }
        return false;
    }

    public static sharedInstance(): Mjolnir {
        if (!Mjolnir.instance) {
            Mjolnir.instance = new Mjolnir();
        }
        return Mjolnir.instance;
    }
}

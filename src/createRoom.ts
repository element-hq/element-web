/*
Copyright 2024 New Vector Ltd.
Copyright 2019, 2020 The Matrix.org Foundation C.I.C.
Copyright 2015, 2016 OpenMarket Ltd

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import {
    type MatrixClient,
    ClientEvent,
    type Room,
    EventType,
    RoomCreateTypeField,
    RoomType,
    type ICreateRoomOpts,
    HistoryVisibility,
    JoinRule,
    Preset,
    RestrictedAllowType,
    Visibility,
} from "matrix-js-sdk/src/matrix";
import { logger } from "matrix-js-sdk/src/logger";

import Modal, { type IHandle } from "./Modal";
import { _t, UserFriendlyError } from "./languageHandler";
import dis from "./dispatcher/dispatcher";
import * as Rooms from "./Rooms";
import { getAddressType } from "./UserAddress";
import { VIRTUAL_ROOM_EVENT_TYPE } from "./call-types";
import SpaceStore from "./stores/spaces/SpaceStore";
import { makeSpaceParentEvent } from "./utils/space";
import { JitsiCall, ElementCall } from "./models/Call";
import { Action } from "./dispatcher/actions";
import ErrorDialog from "./components/views/dialogs/ErrorDialog";
import Spinner from "./components/views/elements/Spinner";
import { type ViewRoomPayload } from "./dispatcher/payloads/ViewRoomPayload";
import { findDMForUser } from "./utils/dm/findDMForUser";
import { privateShouldBeEncrypted } from "./utils/rooms";
import { shouldForceDisableEncryption } from "./utils/crypto/shouldForceDisableEncryption";
import { waitForMember } from "./utils/membership";
import { PreferredRoomVersions } from "./utils/PreferredRoomVersions";
import SettingsStore from "./settings/SettingsStore";
import { MEGOLM_ENCRYPTION_ALGORITHM } from "./utils/crypto";

// we define a number of interfaces which take their names from the js-sdk
/* eslint-disable camelcase */

export interface IOpts {
    dmUserId?: string;
    createOpts?: ICreateRoomOpts;
    spinner?: boolean;
    guestAccess?: boolean;
    encryption?: boolean;
    inlineErrors?: boolean;
    andView?: boolean;
    avatar?: File | string; // will upload if given file, else mxcUrl is needed
    roomType?: RoomType | string;
    historyVisibility?: HistoryVisibility;
    parentSpace?: Room;
    // contextually only makes sense if parentSpace is specified, if true then will be added to parentSpace as suggested
    suggested?: boolean;
    joinRule?: JoinRule;
}

const DEFAULT_EVENT_POWER_LEVELS = {
    [EventType.RoomName]: 50,
    [EventType.RoomAvatar]: 50,
    [EventType.RoomPowerLevels]: 100,
    [EventType.RoomHistoryVisibility]: 100,
    [EventType.RoomCanonicalAlias]: 50,
    [EventType.RoomTombstone]: 100,
    [EventType.RoomServerAcl]: 100,
    [EventType.RoomEncryption]: 100,
};

/**
 * Create a new room, and switch to it.
 *
 * @param client The Matrix Client instance to create the room with
 * @param {object=} opts parameters for creating the room
 * @param {string=} opts.dmUserId If specified, make this a DM room for this user and invite them
 * @param {object=} opts.createOpts set of options to pass to createRoom call.
 * @param {bool=} opts.spinner True to show a modal spinner while the room is created.
 *     Default: True
 * @param {bool=} opts.guestAccess Whether to enable guest access.
 *     Default: True
 * @param {bool=} opts.encryption Whether to enable encryption.
 *     Default: False
 * @param {bool=} opts.inlineErrors True to raise errors off the promise instead of resolving to null.
 *     Default: False
 * @param {bool=} opts.andView True to dispatch an action to view the room once it has been created.
 *
 * @returns {Promise} which resolves to the room id, or null if the
 * action was aborted or failed.
 */
export default async function createRoom(client: MatrixClient, opts: IOpts): Promise<string | null> {
    opts = opts || {};
    if (opts.spinner === undefined) opts.spinner = true;
    if (opts.guestAccess === undefined) opts.guestAccess = true;
    if (opts.encryption === undefined) opts.encryption = false;

    if (client.isGuest()) {
        dis.dispatch({ action: "require_registration" });
        return null;
    }

    const defaultPreset = opts.dmUserId ? Preset.TrustedPrivateChat : Preset.PrivateChat;

    // set some defaults for the creation
    const createOpts: ICreateRoomOpts = opts.createOpts || {};
    createOpts.preset = createOpts.preset || defaultPreset;
    createOpts.visibility = createOpts.visibility || Visibility.Private;

    // We allow UX of DMing ourselves as a form of creating a personal room but the server throws
    // an error when a user tries to invite themselves so we filter it out
    if (opts.dmUserId && opts.dmUserId !== client.getUserId() && createOpts.invite === undefined) {
        switch (getAddressType(opts.dmUserId)) {
            case "mx-user-id":
                createOpts.invite = [opts.dmUserId];
                break;
            case "email": {
                const isUrl = client.getIdentityServerUrl(true);
                if (!isUrl) {
                    throw new UserFriendlyError("cannot_invite_without_identity_server");
                }
                createOpts.invite_3pid = [
                    {
                        id_server: isUrl,
                        medium: "email",
                        address: opts.dmUserId,
                    },
                ];
                break;
            }
        }
    }
    if (opts.dmUserId && createOpts.is_direct === undefined) {
        createOpts.is_direct = true;
    }

    if (opts.roomType) {
        createOpts.creation_content = {
            ...createOpts.creation_content,
            [RoomCreateTypeField]: opts.roomType,
        };

        // Video rooms require custom power levels
        if (opts.roomType === RoomType.ElementVideo) {
            createOpts.power_level_content_override = {
                events: {
                    ...DEFAULT_EVENT_POWER_LEVELS,
                    // Allow all users to send call membership updates
                    [JitsiCall.MEMBER_EVENT_TYPE]: 0,
                    // Make widgets immutable, even to admins
                    "im.vector.modular.widgets": 200,
                },
                users: {
                    // Temporarily give ourselves the power to set up a widget
                    [client.getSafeUserId()]: 200,
                },
            };
        } else if (opts.roomType === RoomType.UnstableCall) {
            createOpts.power_level_content_override = {
                events: {
                    ...DEFAULT_EVENT_POWER_LEVELS,
                    // Allow all users to send call membership updates
                    [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
                    // Make calls immutable, even to admins
                    [ElementCall.CALL_EVENT_TYPE.name]: 200,
                },
                users: {
                    // Temporarily give ourselves the power to set up a call
                    [client.getSafeUserId()]: 200,
                },
            };
        }
    } else if (SettingsStore.getValue("feature_group_calls")) {
        createOpts.power_level_content_override = {
            events: {
                ...DEFAULT_EVENT_POWER_LEVELS,
                // It should always (including non video rooms) be possible to join a group call.
                [ElementCall.MEMBER_EVENT_TYPE.name]: 0,
                // Make sure only admins can enable it (DEPRECATED)
                [ElementCall.CALL_EVENT_TYPE.name]: 100,
            },
        };
    }

    // By default, view the room after creating it
    if (opts.andView === undefined) {
        opts.andView = true;
    }

    createOpts.initial_state = createOpts.initial_state || [];

    // Allow guests by default since the room is private and they'd
    // need an invite. This means clicking on a 3pid invite email can
    // actually drop you right in to a chat.
    if (opts.guestAccess) {
        createOpts.initial_state.push({
            type: "m.room.guest_access",
            state_key: "",
            content: {
                guest_access: "can_join",
            },
        });
    }

    if (opts.encryption) {
        createOpts.initial_state.push({
            type: "m.room.encryption",
            state_key: "",
            content: {
                algorithm: MEGOLM_ENCRYPTION_ALGORITHM,
            },
        });
    }

    if (opts.joinRule === JoinRule.Knock) {
        createOpts.room_version = PreferredRoomVersions.KnockRooms;
    }

    if (opts.parentSpace) {
        createOpts.initial_state.push(makeSpaceParentEvent(opts.parentSpace, true));
        if (!opts.historyVisibility) {
            opts.historyVisibility =
                createOpts.preset === Preset.PublicChat ? HistoryVisibility.WorldReadable : HistoryVisibility.Invited;
        }

        if (opts.joinRule === JoinRule.Restricted) {
            createOpts.room_version = PreferredRoomVersions.RestrictedRooms;

            createOpts.initial_state.push({
                type: EventType.RoomJoinRules,
                content: {
                    join_rule: JoinRule.Restricted,
                    allow: [
                        {
                            type: RestrictedAllowType.RoomMembership,
                            room_id: opts.parentSpace.roomId,
                        },
                    ],
                },
            });
        }
    }

    // we handle the restricted join rule in the parentSpace handling block above
    if (opts.joinRule && opts.joinRule !== JoinRule.Restricted) {
        createOpts.initial_state.push({
            type: EventType.RoomJoinRules,
            content: { join_rule: opts.joinRule },
        });
    }

    if (opts.avatar) {
        let url = opts.avatar;
        if (opts.avatar instanceof File) {
            ({ content_uri: url } = await client.uploadContent(opts.avatar));
        }

        createOpts.initial_state.push({
            type: EventType.RoomAvatar,
            content: { url },
        });
    }

    if (opts.historyVisibility) {
        createOpts.initial_state.push({
            type: EventType.RoomHistoryVisibility,
            content: {
                history_visibility: opts.historyVisibility,
            },
        });
    }

    let modal: IHandle<any> | undefined;
    if (opts.spinner) modal = Modal.createDialog(Spinner, undefined, "mx_Dialog_spinner");

    let roomId: string;
    let room: Promise<Room>;
    return client
        .createRoom(createOpts)
        .catch(function (err) {
            // NB This checks for the Synapse-specific error condition of a room creation
            // having been denied because the requesting user wanted to publish the room,
            // but the server denies them that permission (via room_list_publication_rules).
            // The check below responds by retrying without publishing the room.
            if (
                err.httpStatus === 403 &&
                err.errcode === "M_UNKNOWN" &&
                err.data.error === "Not allowed to publish room"
            ) {
                logger.warn("Failed to publish room, try again without publishing it");
                createOpts.visibility = Visibility.Private;
                return client.createRoom(createOpts);
            } else {
                return Promise.reject(err);
            }
        })
        .finally(function () {
            if (modal) modal.close();
        })
        .then(async (res): Promise<void> => {
            roomId = res.room_id;

            room = new Promise((resolve) => {
                const storedRoom = client.getRoom(roomId);
                if (storedRoom) {
                    resolve(storedRoom);
                } else {
                    // The room hasn't arrived down sync yet
                    const onRoom = (emittedRoom: Room): void => {
                        if (emittedRoom.roomId === roomId) {
                            resolve(emittedRoom);
                            client.off(ClientEvent.Room, onRoom);
                        }
                    };
                    client.on(ClientEvent.Room, onRoom);
                }
            });

            if (opts.dmUserId) await Rooms.setDMRoom(client, roomId, opts.dmUserId);
        })
        .then(() => {
            if (opts.parentSpace) {
                return SpaceStore.instance.addRoomToSpace(
                    opts.parentSpace,
                    roomId,
                    [client.getDomain()!],
                    opts.suggested,
                );
            }
        })
        .then(async (): Promise<void> => {
            if (opts.roomType === RoomType.ElementVideo) {
                // Set up this video room with a Jitsi call
                await JitsiCall.create(await room);

                // Reset our power level back to admin so that the widget becomes immutable
                await client.setPowerLevel(roomId, client.getUserId()!, 100);
            } else if (opts.roomType === RoomType.UnstableCall) {
                // Set up this video room with an Element call
                ElementCall.create(await room);

                // Reset our power level back to admin so that the call becomes immutable
                await client.setPowerLevel(roomId, client.getUserId()!, 100);
            }
        })
        .then(
            function () {
                // NB we haven't necessarily blocked on the room promise, so we race
                // here with the client knowing that the room exists, causing things
                // like https://github.com/vector-im/vector-web/issues/1813
                // Even if we were to block on the echo, servers tend to split the room
                // state over multiple syncs so we can't atomically know when we have the
                // entire thing.
                if (opts.andView) {
                    dis.dispatch<ViewRoomPayload>({
                        action: Action.ViewRoom,
                        room_id: roomId,
                        should_peek: false,
                        // Creating a room will have joined us to the room,
                        // so we are expecting the room to come down the sync
                        // stream, if it hasn't already.
                        joining: true,
                        justCreatedOpts: opts,
                        metricsTrigger: "Created",
                    });
                }
                return roomId;
            },
            function (err) {
                // Raise the error if the caller requested that we do so.
                if (opts.inlineErrors) throw err;

                // We also failed to join the room (this sets joining to false in RoomViewStore)
                dis.dispatch({
                    action: Action.JoinRoomError,
                    roomId,
                });
                logger.error("Failed to create room " + roomId + " " + err);
                let description = _t("create_room|generic_error");
                if (err.errcode === "M_UNSUPPORTED_ROOM_VERSION") {
                    // Technically not possible with the UI as of April 2019 because there's no
                    // options for the user to change this. However, it's not a bad thing to report
                    // the error to the user for if/when the UI is available.
                    description = _t("create_room|unsupported_version");
                }
                Modal.createDialog(ErrorDialog, {
                    title: _t("create_room|error_title"),
                    description,
                });
                return null;
            },
        );
}

/*
 * Ensure that for every user in a room, there is at least one device that we
 * can encrypt to.
 */
export async function canEncryptToAllUsers(client: MatrixClient, userIds: string[]): Promise<boolean> {
    try {
        const usersDeviceMap = await client.getCrypto()?.getUserDeviceInfo(userIds, true);
        if (!usersDeviceMap) {
            return false;
        }

        for (const devices of usersDeviceMap.values()) {
            if (devices.size === 0) {
                // This user does not have any encryption-capable devices.
                return false;
            }
        }
    } catch (e) {
        logger.error("Error determining if it's possible to encrypt to all users: ", e);
        return false; // assume not
    }

    return true;
}

// Similar to ensureDMExists but also adds creation content
// without polluting ensureDMExists with unrelated stuff (also
// they're never encrypted).
export async function ensureVirtualRoomExists(
    client: MatrixClient,
    userId: string,
    nativeRoomId: string,
): Promise<string | null> {
    const existingDMRoom = findDMForUser(client, userId);
    let roomId: string | null;
    if (existingDMRoom) {
        roomId = existingDMRoom.roomId;
    } else {
        roomId = await createRoom(client, {
            dmUserId: userId,
            spinner: false,
            andView: false,
            createOpts: {
                creation_content: {
                    // This allows us to recognise that the room is a virtual room
                    // when it comes down our sync stream (we also put the ID of the
                    // respective native room in there because why not?)
                    [VIRTUAL_ROOM_EVENT_TYPE]: nativeRoomId,
                },
            },
        });
    }
    return roomId;
}

export async function ensureDMExists(client: MatrixClient, userId: string): Promise<string | null> {
    const existingDMRoom = findDMForUser(client, userId);
    let roomId: string | null;
    if (existingDMRoom) {
        roomId = existingDMRoom.roomId;
    } else {
        let encryption: boolean | undefined;
        if (privateShouldBeEncrypted(client)) {
            encryption = await canEncryptToAllUsers(client, [userId]);
        }

        roomId = await createRoom(client, { encryption, dmUserId: userId, spinner: false, andView: false });
        if (!roomId) return null;
        await waitForMember(client, roomId, userId);
    }
    return roomId;
}

interface AllowedEncryptionSetting {
    /**
     * True when the user is allowed to choose whether encryption is enabled
     */
    allowChange: boolean;
    /**
     * Set when user is not allowed to choose encryption setting
     * True when encryption is forced to enabled
     */
    forcedValue?: boolean;
}
/**
 * Check if server configuration supports the user changing encryption for a room
 * First check if server features force enable encryption for the given room type
 * If not, check if server .well-known forces encryption to disabled
 * If either are forced, then do not allow the user to change room's encryption
 * @param client
 * @param chatPreset chat type
 * @returns Promise<boolean>
 */
export async function checkUserIsAllowedToChangeEncryption(
    client: MatrixClient,
    chatPreset: Preset,
): Promise<AllowedEncryptionSetting> {
    const doesServerForceEncryptionForPreset = await client.doesServerForceEncryptionForPreset(chatPreset);
    const doesWellKnownForceDisableEncryption = shouldForceDisableEncryption(client);

    // server is forcing encryption to ENABLED
    // while .well-known config is forcing it to DISABLED
    // server version config overrides wk config
    if (doesServerForceEncryptionForPreset && doesWellKnownForceDisableEncryption) {
        console.warn(
            `Conflicting e2ee settings: server config and .well-known configuration disagree. Using server forced encryption setting for chat type ${chatPreset}`,
        );
    }

    if (doesServerForceEncryptionForPreset) {
        return { allowChange: false, forcedValue: true };
    }
    if (doesWellKnownForceDisableEncryption) {
        return { allowChange: false, forcedValue: false };
    }

    return { allowChange: true };
}

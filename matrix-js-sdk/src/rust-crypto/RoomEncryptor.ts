/*
Copyright 2023 The Matrix.org Foundation C.I.C.

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

import { EncryptionSettings, OlmMachine, RoomId, UserId } from "@matrix-org/matrix-sdk-crypto-js";

import { EventType } from "../@types/event";
import { IContent, MatrixEvent } from "../models/event";
import { Room } from "../models/room";
import { logger, PrefixedLogger } from "../logger";
import { KeyClaimManager } from "./KeyClaimManager";
import { RoomMember } from "../models/room-member";
import { OutgoingRequestProcessor } from "./OutgoingRequestProcessor";

/**
 * RoomEncryptor: responsible for encrypting messages to a given room
 */
export class RoomEncryptor {
    private readonly prefixedLogger: PrefixedLogger;

    /**
     * @param olmMachine - The rust-sdk's OlmMachine
     * @param keyClaimManager - Our KeyClaimManager, which manages the queue of one-time-key claim requests
     * @param room - The room we want to encrypt for
     * @param encryptionSettings - body of the m.room.encryption event currently in force in this room
     */
    public constructor(
        private readonly olmMachine: OlmMachine,
        private readonly keyClaimManager: KeyClaimManager,
        private readonly outgoingRequestProcessor: OutgoingRequestProcessor,
        private readonly room: Room,
        private encryptionSettings: IContent,
    ) {
        this.prefixedLogger = logger.withPrefix(`[${room.roomId} encryption]`);
    }

    /**
     * Handle a new `m.room.encryption` event in this room
     *
     * @param config - The content of the encryption event
     */
    public onCryptoEvent(config: IContent): void {
        if (JSON.stringify(this.encryptionSettings) != JSON.stringify(config)) {
            this.prefixedLogger.error(`Ignoring m.room.encryption event which requests a change of config`);
        }
    }

    /**
     * Handle a new `m.room.member` event in this room
     *
     * @param member - new membership state
     */
    public onRoomMembership(member: RoomMember): void {
        this.prefixedLogger.debug(`${member.membership} event for ${member.userId}`);

        if (
            member.membership == "join" ||
            (member.membership == "invite" && this.room.shouldEncryptForInvitedMembers())
        ) {
            // make sure we are tracking the deviceList for this user
            this.prefixedLogger.debug(`starting to track devices for: ${member.userId}`);
            this.olmMachine.updateTrackedUsers([new UserId(member.userId)]);
        }

        // TODO: handle leaves (including our own)
    }

    /**
     * Prepare to encrypt events in this room.
     *
     * This ensures that we have a megolm session ready to use and that we have shared its key with all the devices
     * in the room.
     */
    public async ensureEncryptionSession(): Promise<void> {
        if (this.encryptionSettings.algorithm !== "m.megolm.v1.aes-sha2") {
            throw new Error(
                `Cannot encrypt in ${this.room.roomId} for unsupported algorithm '${this.encryptionSettings.algorithm}'`,
            );
        }

        const members = await this.room.getEncryptionTargetMembers();
        this.prefixedLogger.debug(
            `Encrypting for users (shouldEncryptForInvitedMembers: ${this.room.shouldEncryptForInvitedMembers()}):`,
            members.map((u) => `${u.userId} (${u.membership})`),
        );

        const userList = members.map((u) => new UserId(u.userId));
        await this.keyClaimManager.ensureSessionsForUsers(userList);

        this.prefixedLogger.debug("Sessions for users are ready; now sharing room key");

        const rustEncryptionSettings = new EncryptionSettings();
        /* FIXME historyVisibility, rotation, etc */

        const shareMessages = await this.olmMachine.shareRoomKey(
            new RoomId(this.room.roomId),
            userList,
            rustEncryptionSettings,
        );
        if (shareMessages) {
            for (const m of shareMessages) {
                await this.outgoingRequestProcessor.makeOutgoingRequest(m);
            }
        }
    }

    /**
     * Discard any existing group session for this room
     */
    public async forceDiscardSession(): Promise<void> {
        const r = await this.olmMachine.invalidateGroupSession(new RoomId(this.room.roomId));
        if (r) {
            this.prefixedLogger.info("Discarded existing group session");
        }
    }

    /**
     * Encrypt an event for this room
     *
     * This will ensure that we have a megolm session for this room, share it with the devices in the room, and
     * then encrypt the event using the session.
     *
     * @param event - Event to be encrypted.
     */
    public async encryptEvent(event: MatrixEvent): Promise<void> {
        await this.ensureEncryptionSession();

        const encryptedContent = await this.olmMachine.encryptRoomEvent(
            new RoomId(this.room.roomId),
            event.getType(),
            JSON.stringify(event.getContent()),
        );

        event.makeEncrypted(
            EventType.RoomMessageEncrypted,
            JSON.parse(encryptedContent),
            this.olmMachine.identityKeys.curve25519.toBase64(),
            this.olmMachine.identityKeys.ed25519.toBase64(),
        );
    }
}

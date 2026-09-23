/*
 * Copyright 2026 Element Creations Ltd.
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
 * Please see LICENSE files in the repository root for full details.
 */

import { type JSX } from "react";
import { type MatrixClient, type MatrixEvent } from "matrix-js-sdk/src/matrix";
import {
    BaseViewModel,
    type MKeyVerificationRequestViewModel as MKeyVerificationRequestViewModelInterface,
    type MKeyVerificationRequestViewSnapshot,
} from "@element-hq/web-shared-components";

import { _t } from "../../../../languageHandler";
import { getNameForEventRoom, userLabelForEventRoom } from "../../../../utils/KeyVerificationStateObserver";

interface MKeyVerificationRequestContent {
    body?: string;
    format?: string;
    formatted_body?: string;
    from_device: string;
    methods: string[];
    msgtype: "m.key.verification.request";
    to: string;
}

export interface MKeyVerificationRequestViewModelProps {
    /**
     * Caller-provided client.
     */
    cli: MatrixClient;
    /**
     * Verification request message event.
     */
    mxEvent: MatrixEvent;
    /**
     * Optional timestamp element rendered in the tile footer slot.
     */
    timestamp?: JSX.Element;
}

/**
 * ViewModel for key verification request message events.
 */
export class MKeyVerificationRequestViewModel
    extends BaseViewModel<MKeyVerificationRequestViewSnapshot, MKeyVerificationRequestViewModelProps>
    implements MKeyVerificationRequestViewModelInterface
{
    public constructor(props: MKeyVerificationRequestViewModelProps) {
        super(props, MKeyVerificationRequestViewModel.computeSnapshot(props));
    }

    public setEvent(mxEvent: MatrixEvent): void {
        this.props = { ...this.props, mxEvent };
        this.updateSnapshotFromProps();
    }

    public setTimestamp(timestamp: JSX.Element | undefined): void {
        this.props = { ...this.props, timestamp };
        this.snapshot.merge({ timestamp });
    }

    private updateSnapshotFromProps(): void {
        this.snapshot.merge(MKeyVerificationRequestViewModel.computeSnapshot(this.props));
    }

    private static computeSnapshot({
        cli,
        mxEvent,
        timestamp,
    }: MKeyVerificationRequestViewModelProps): MKeyVerificationRequestViewSnapshot {
        const myUserId = cli.getSafeUserId();
        const content = mxEvent.getContent<MKeyVerificationRequestContent>();
        const sender = mxEvent.getSender();
        const roomId = mxEvent.getRoomId();

        if (!sender) {
            throw new Error("Verification request did not include a sender!");
        }
        if (!roomId) {
            throw new Error("Verification request did not include a room ID!");
        }

        if (sender === myUserId) {
            return {
                title: _t("timeline|m.key.verification.request|you_started"),
                subtitle: userLabelForEventRoom(cli, content.to, roomId),
                timestamp,
            };
        }

        const name = getNameForEventRoom(cli, sender, roomId);
        return {
            title: _t("timeline|m.key.verification.request|user_wants_to_verify", { name }),
            subtitle: userLabelForEventRoom(cli, sender, roomId),
            timestamp,
        };
    }
}

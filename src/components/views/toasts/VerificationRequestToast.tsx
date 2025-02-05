/*
Copyright 2024 New Vector Ltd.
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import {
    canAcceptVerificationRequest,
    type VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto-api";
import { logger } from "matrix-js-sdk/src/logger";
import { type Device } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { RightPanelPhases } from "../../../stores/right-panel/RightPanelStorePhases";
import { userLabelForEventRoom } from "../../../utils/KeyVerificationStateObserver";
import dis from "../../../dispatcher/dispatcher";
import ToastStore from "../../../stores/ToastStore";
import Modal from "../../../Modal";
import GenericToast from "./GenericToast";
import { Action } from "../../../dispatcher/actions";
import VerificationRequestDialog from "../dialogs/VerificationRequestDialog";
import RightPanelStore from "../../../stores/right-panel/RightPanelStore";
import { type ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";
import { getDeviceCryptoInfo } from "../../../utils/crypto/deviceInfo";

interface IProps {
    toastKey: string;
    request: VerificationRequest;
}

interface IState {
    /** number of seconds left in the timeout counter. Zero if there is no timeout. */
    counter: number;
    device?: Device;
    ip?: string;
}

export default class VerificationRequestToast extends React.PureComponent<IProps, IState> {
    private intervalHandle?: number;

    public constructor(props: IProps) {
        super(props);
        this.state = { counter: Math.ceil((props.request.timeout ?? 0) / 1000) };
    }

    public async componentDidMount(): Promise<void> {
        const { request } = this.props;
        if (request.timeout && request.timeout > 0) {
            this.intervalHandle = window.setInterval(() => {
                let { counter } = this.state;
                counter = Math.max(0, counter - 1);
                this.setState({ counter });
            }, 1000);
        }
        request.on(VerificationRequestEvent.Change, this.checkRequestIsPending);
        // We should probably have a separate class managing the active verification toasts,
        // rather than monitoring this in the toast component itself, since we'll get problems
        // like the toast not going away when the verification is cancelled unless it's the
        // one on the top (ie. the one that's mounted).
        // As a quick & dirty fix, check the toast is still relevant when it mounts (this prevents
        // a toast hanging around after logging in if you did a verification as part of login).
        this.checkRequestIsPending();

        const otherDeviceId = request.otherDeviceId;
        if (request.isSelfVerification && !!otherDeviceId) {
            const cli = MatrixClientPeg.safeGet();
            const device = await cli.getDevice(otherDeviceId);
            this.setState({
                ip: device.last_seen_ip,
                device: await getDeviceCryptoInfo(cli, cli.getSafeUserId(), otherDeviceId),
            });
        }
    }

    public componentWillUnmount(): void {
        clearInterval(this.intervalHandle);
        const { request } = this.props;
        request.off(VerificationRequestEvent.Change, this.checkRequestIsPending);
    }

    private checkRequestIsPending = (): void => {
        const { request } = this.props;
        if (!canAcceptVerificationRequest(request)) {
            ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        }
    };

    public cancel = (): void => {
        ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        try {
            this.props.request.cancel();
        } catch (err) {
            logger.error("Error while cancelling verification request", err);
        }
    };

    public accept = async (): Promise<void> => {
        ToastStore.sharedInstance().dismissToast(this.props.toastKey);
        const { request } = this.props;
        // no room id for to_device requests
        const cli = MatrixClientPeg.safeGet();
        try {
            if (request.roomId) {
                dis.dispatch<ViewRoomPayload>({
                    action: Action.ViewRoom,
                    room_id: request.roomId,
                    should_peek: false,
                    metricsTrigger: "VerificationRequest",
                });
                const member = cli.getUser(request.otherUserId) ?? undefined;
                RightPanelStore.instance.setCards(
                    [
                        { phase: RightPanelPhases.RoomSummary },
                        { phase: RightPanelPhases.MemberInfo, state: { member } },
                        { phase: RightPanelPhases.EncryptionPanel, state: { verificationRequest: request, member } },
                    ],
                    undefined,
                    request.roomId,
                );
            } else {
                Modal.createDialog(
                    VerificationRequestDialog,
                    {
                        verificationRequest: request,
                        onFinished: () => {
                            request.cancel();
                        },
                    },
                    undefined,
                    /* priority = */ false,
                    /* static = */ true,
                );
            }
            await request.accept();
        } catch (err) {
            logger.error("Failed to accept verification request", err);
        }
    };

    public render(): React.ReactNode {
        const { request } = this.props;
        let description;
        let detail;
        if (request.isSelfVerification) {
            if (this.state.device) {
                description = this.state.device.displayName;
                detail = _t("encryption|verification|request_toast_detail", {
                    deviceId: this.state.device.deviceId,
                    ip: this.state.ip,
                });
            }
        } else {
            const client = MatrixClientPeg.safeGet();
            const userId = request.otherUserId;
            const roomId = request.roomId;
            description = roomId ? userLabelForEventRoom(client, userId, roomId) : userId;
            // for legacy to_device verification requests
            if (description === userId) {
                const user = client.getUser(userId);
                if (user && user.displayName) {
                    description = _t("name_and_id", { name: user.displayName, userId });
                }
            }
        }
        const declineLabel =
            this.state.counter === 0
                ? _t("action|ignore")
                : _t("encryption|verification|request_toast_decline_counter", { counter: this.state.counter });

        return (
            <GenericToast
                description={description}
                detail={detail}
                primaryLabel={
                    request.isSelfVerification || !request.roomId
                        ? _t("encryption|verification|request_toast_accept")
                        : _t("encryption|verification|request_toast_accept_user")
                }
                onPrimaryClick={this.accept}
                secondaryLabel={declineLabel}
                onSecondaryClick={this.cancel}
            />
        );
    }
}

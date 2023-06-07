/*
Copyright 2019-2021 The Matrix.org Foundation C.I.C.

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

import React from "react";
import {
    VerificationRequest,
    VerificationRequestEvent,
} from "matrix-js-sdk/src/crypto/verification/request/VerificationRequest";
import { DeviceInfo } from "matrix-js-sdk/src/crypto/deviceinfo";
import { logger } from "matrix-js-sdk/src/logger";

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
import { ViewRoomPayload } from "../../../dispatcher/payloads/ViewRoomPayload";

interface IProps {
    toastKey: string;
    request: VerificationRequest;
}

interface IState {
    counter: number;
    device?: DeviceInfo;
    ip?: string;
}

export default class VerificationRequestToast extends React.PureComponent<IProps, IState> {
    private intervalHandle?: number;

    public constructor(props: IProps) {
        super(props);
        this.state = { counter: Math.ceil(props.request.timeout / 1000) };
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

        if (request.isSelfVerification) {
            const cli = MatrixClientPeg.get();
            const device = request.otherDeviceId ? await cli.getDevice(request.otherDeviceId) : null;
            const ip = device?.last_seen_ip;
            this.setState({
                device:
                    (request.otherDeviceId && cli.getStoredDevice(cli.getSafeUserId(), request.otherDeviceId)) ||
                    undefined,
                ip,
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
        if (!request.canAccept) {
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
        const cli = MatrixClientPeg.get();
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
                        { phase: RightPanelPhases.RoomMemberInfo, state: { member } },
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
            logger.error(err.message);
        }
    };

    public render(): React.ReactNode {
        const { request } = this.props;
        let description;
        let detail;
        if (request.isSelfVerification) {
            if (this.state.device) {
                description = this.state.device.getDisplayName();
                detail = _t("%(deviceId)s from %(ip)s", {
                    deviceId: this.state.device.deviceId,
                    ip: this.state.ip,
                });
            }
        } else {
            const userId = request.otherUserId;
            const roomId = request.roomId;
            description = roomId ? userLabelForEventRoom(MatrixClientPeg.get(), userId, roomId) : userId;
            // for legacy to_device verification requests
            if (description === userId) {
                const client = MatrixClientPeg.get();
                const user = client.getUser(userId);
                if (user && user.displayName) {
                    description = _t("%(name)s (%(userId)s)", { name: user.displayName, userId });
                }
            }
        }
        const declineLabel =
            this.state.counter === 0 ? _t("Ignore") : _t("Ignore (%(counter)s)", { counter: this.state.counter });

        return (
            <GenericToast
                description={description}
                detail={detail}
                acceptLabel={_t("Verify Session")}
                onAccept={this.accept}
                rejectLabel={declineLabel}
                onReject={this.cancel}
            />
        );
    }
}

/*
Copyright 2024 New Vector Ltd.
Copyright 2020-2022 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import { CallState, type MatrixCall } from "matrix-js-sdk/src/webrtc/call";
import React from "react";
import { Resizable } from "re-resizable";

import LegacyCallHandler, { LegacyCallHandlerEvent } from "../../../LegacyCallHandler";
import LegacyCallView from "./LegacyCallView";
import type ResizeNotifier from "../../../utils/ResizeNotifier";

interface IProps {
    // What room we should display the call for
    roomId: string;

    resizeNotifier: ResizeNotifier;

    showApps?: boolean;
}

interface IState {
    call: MatrixCall | null;
    sidebarShown: boolean;
}

/*
 * Wrapper for LegacyCallView that always display the call in a given room,
 * or nothing if there is no call in that room.
 */
export default class LegacyCallViewForRoom extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        const call = this.getCall();
        this.state = {
            call,
            sidebarShown: !!call && LegacyCallHandler.instance.isCallSidebarShown(call.callId),
        };
    }

    public componentDidMount(): void {
        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.CallState, this.updateCall);
        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCall);
        LegacyCallHandler.instance.addListener(LegacyCallHandlerEvent.ShownSidebarsChanged, this.updateCall);
    }

    public componentWillUnmount(): void {
        LegacyCallHandler.instance.removeListener(LegacyCallHandlerEvent.CallState, this.updateCall);
        LegacyCallHandler.instance.removeListener(LegacyCallHandlerEvent.CallChangeRoom, this.updateCall);
        LegacyCallHandler.instance.removeListener(LegacyCallHandlerEvent.ShownSidebarsChanged, this.updateCall);
    }

    private updateCall = (): void => {
        const newCall = this.getCall();
        if (newCall !== this.state.call) {
            this.setState({ call: newCall });
        }
        const newSidebarShown = !!newCall && LegacyCallHandler.instance.isCallSidebarShown(newCall.callId);
        if (newSidebarShown !== this.state.sidebarShown) {
            this.setState({ sidebarShown: newSidebarShown });
        }
    };

    private getCall(): MatrixCall | null {
        const call = LegacyCallHandler.instance.getCallForRoom(this.props.roomId);

        if (call && [CallState.Ended, CallState.Ringing].includes(call.state)) return null;
        return call;
    }

    private onResizeStart = (): void => {
        this.props.resizeNotifier.startResizing();
    };

    private onResize = (): void => {
        this.props.resizeNotifier.notifyTimelineHeightChanged();
    };

    private onResizeStop = (): void => {
        this.props.resizeNotifier.stopResizing();
    };

    private setSidebarShown = (sidebarShown: boolean): void => {
        if (!this.state.call) return;
        LegacyCallHandler.instance.setCallSidebarShown(this.state.call.callId, sidebarShown);
    };

    public render(): React.ReactNode {
        if (!this.state.call) return null;

        return (
            <div className="mx_LegacyCallViewForRoom">
                <Resizable
                    minHeight={380}
                    maxHeight="80vh"
                    enable={{
                        top: false,
                        right: false,
                        bottom: true,
                        left: false,
                        topRight: false,
                        bottomRight: false,
                        bottomLeft: false,
                        topLeft: false,
                    }}
                    onResizeStart={this.onResizeStart}
                    onResize={this.onResize}
                    onResizeStop={this.onResizeStop}
                    className="mx_LegacyCallViewForRoom_ResizeWrapper"
                    handleClasses={{ bottom: "mx_LegacyCallViewForRoom_ResizeHandle" }}
                >
                    <LegacyCallView
                        call={this.state.call}
                        pipMode={false}
                        showApps={this.props.showApps}
                        sidebarShown={this.state.sidebarShown}
                        setSidebarShown={this.setSidebarShown}
                    />
                </Resizable>
            </div>
        );
    }
}

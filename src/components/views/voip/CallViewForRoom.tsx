/*
Copyright 2020 - 2022 The Matrix.org Foundation C.I.C.

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

import { CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import React from 'react';
import { Resizable } from "re-resizable";

import CallHandler, { CallHandlerEvent } from '../../../CallHandler';
import CallView from './CallView';
import ResizeNotifier from "../../../utils/ResizeNotifier";

interface IProps {
    // What room we should display the call for
    roomId: string;

    resizeNotifier: ResizeNotifier;

    showApps?: boolean;
}

interface IState {
    call: MatrixCall;
}

/*
 * Wrapper for CallView that always display the call in a given room,
 * or nothing if there is no call in that room.
 */
export default class CallViewForRoom extends React.Component<IProps, IState> {
    constructor(props: IProps) {
        super(props);
        this.state = {
            call: this.getCall(),
        };
    }

    public componentDidMount() {
        CallHandler.instance.addListener(CallHandlerEvent.CallState, this.updateCall);
        CallHandler.instance.addListener(CallHandlerEvent.CallChangeRoom, this.updateCall);
    }

    public componentWillUnmount() {
        CallHandler.instance.removeListener(CallHandlerEvent.CallState, this.updateCall);
        CallHandler.instance.removeListener(CallHandlerEvent.CallChangeRoom, this.updateCall);
    }

    private updateCall = () => {
        const newCall = this.getCall();
        if (newCall !== this.state.call) {
            this.setState({ call: newCall });
        }
    };

    private getCall(): MatrixCall {
        const call = CallHandler.instance.getCallForRoom(this.props.roomId);

        if (call && [CallState.Ended, CallState.Ringing].includes(call.state)) return null;
        return call;
    }

    private onResizeStart = () => {
        this.props.resizeNotifier.startResizing();
    };

    private onResize = () => {
        this.props.resizeNotifier.notifyTimelineHeightChanged();
    };

    private onResizeStop = () => {
        this.props.resizeNotifier.stopResizing();
    };

    public render() {
        if (!this.state.call) return null;

        return (
            <div className="mx_CallViewForRoom">
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
                    className="mx_CallViewForRoom_ResizeWrapper"
                    handleClasses={{ bottom: "mx_CallViewForRoom_ResizeHandle" }}
                >
                    <CallView
                        call={this.state.call}
                        pipMode={false}
                        showApps={this.props.showApps}
                    />
                </Resizable>
            </div>
        );
    }
}

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

import { CallState, MatrixCall } from 'matrix-js-sdk/src/webrtc/call';
import React from 'react';
import CallHandler from '../../../CallHandler';
import CallView from './CallView';
import dis from '../../../dispatcher/dispatcher';
import {Resizable} from "re-resizable";
import ResizeNotifier from "../../../utils/ResizeNotifier";
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    // What room we should display the call for
    roomId: string,

    // maxHeight style attribute for the video panel
    maxVideoHeight?: number;

    resizeNotifier: ResizeNotifier,
}

interface IState {
    call: MatrixCall,
}

/*
 * Wrapper for CallView that always display the call in a given room,
 * or nothing if there is no call in that room.
 */
@replaceableComponent("views.voip.CallViewForRoom")
export default class CallViewForRoom extends React.Component<IProps, IState> {
    private dispatcherRef: string;

    constructor(props: IProps) {
        super(props);
        this.state = {
            call: this.getCall(),
        };
    }

    public componentDidMount() {
        this.dispatcherRef = dis.register(this.onAction);
    }

    public componentWillUnmount() {
        dis.unregister(this.dispatcherRef);
    }

    private onAction = (payload) => {
        switch (payload.action) {
            case 'call_state': {
                const newCall = this.getCall();
                if (newCall !== this.state.call) {
                    this.setState({call: newCall});
                }
                break;
            }
        }
    };

    private getCall(): MatrixCall {
        const call = CallHandler.sharedInstance().getCallForRoom(this.props.roomId);

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
        // We subtract 8 as it the margin-bottom of the mx_CallViewForRoom_ResizeWrapper
        const maxHeight = this.props.maxVideoHeight - 8;

        return (
            <div className="mx_CallViewForRoom">
                <Resizable
                    minHeight={380}
                    maxHeight={maxHeight}
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
                    handleClasses={{bottom: "mx_CallViewForRoom_ResizeHandle"}}
                >
                    <CallView
                        call={this.state.call}
                        pipMode={false}
                    />
                </Resizable>
            </div>
        );
    }
}

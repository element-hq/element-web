/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2017 Vector Creations Ltd
Copyright 2017 New Vector Ltd
Copyright 2018 New Vector Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import dis from '../../../dispatcher/dispatcher';
import RightPanelStore from "../../../stores/RightPanelStore";

export const HEADER_KIND_ROOM = "room";
export const HEADER_KIND_GROUP = "group";

const HEADER_KINDS = [HEADER_KIND_GROUP, HEADER_KIND_ROOM];

export default class HeaderButtons extends React.Component {
    constructor(props, kind) {
        super(props);

        if (!HEADER_KINDS.includes(kind)) throw new Error(`Invalid header kind: ${kind}`);

        const rps = RightPanelStore.getSharedInstance();
        this.state = {
            headerKind: kind,
            phase: kind === HEADER_KIND_ROOM ? rps.visibleRoomPanelPhase : rps.visibleGroupPanelPhase,
        };
    }

    componentDidMount() {
        this._storeToken = RightPanelStore.getSharedInstance().addListener(this.onRightPanelUpdate.bind(this));
        this._dispatcherRef = dis.register(this.onAction.bind(this)); // used by subclasses
    }

    componentWillUnmount() {
        if (this._storeToken) this._storeToken.remove();
        if (this._dispatcherRef) dis.unregister(this._dispatcherRef);
    }

    onAction(payload) {
        // Ignore - intended to be overridden by subclasses
    }

    setPhase(phase, extras) {
        dis.dispatch({
            action: 'set_right_panel_phase',
            phase: phase,
            refireParams: extras,
        });
    }

    isPhase(phases: string | string[]) {
        if (Array.isArray(phases)) {
            return phases.includes(this.state.phase);
        } else {
            return phases === this.state.phase;
        }
    }

    onRightPanelUpdate() {
        const rps = RightPanelStore.getSharedInstance();
        if (this.state.headerKind === HEADER_KIND_ROOM) {
            this.setState({phase: rps.visibleRoomPanelPhase});
        } else if (this.state.headerKind === HEADER_KIND_GROUP) {
            this.setState({phase: rps.visibleGroupPanelPhase});
        }
    }

    render() {
        // inline style as this will be swapped around in future commits
        return <div className="mx_HeaderButtons" role="tablist">
            {this.renderButtons()}
        </div>;
    }
}

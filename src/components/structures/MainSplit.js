/*
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
import { Resizable } from 're-resizable';

export default class MainSplit extends React.Component {
    _onResized = (event, direction, refToElement, delta) => {
        window.localStorage.setItem("mx_rhs_size", this._loadSidePanelSize().width + delta.width);
    }

    _loadSidePanelSize() {
        let rhsSize = parseInt(window.localStorage.getItem("mx_rhs_size"), 10);

        if (isNaN(rhsSize)) {
            rhsSize = 350;
        }

        return {
            height: "100%",
            width: rhsSize,
        };
    }

    render() {
        const bodyView = React.Children.only(this.props.children);
        const panelView = this.props.panel;

        const hasResizer = !this.props.collapsedRhs && panelView;

        let children;
        if (hasResizer) {
            children = <Resizable
                defaultSize={this._loadSidePanelSize()}
                minWidth={264}
                maxWidth="50%"
                enable={{
                    top: false,
                    right: false,
                    bottom: false,
                    left: true,
                    topRight: false,
                    bottomRight: false,
                    bottomLeft: false,
                    topLeft: false,
                }}
                onResizeStop={this._onResized}
                className="mx_RightPanel_ResizeWrapper"
                handleClasses={{left: "mx_RightPanel_ResizeHandle"}}
            >
                { panelView }
            </Resizable>;
        }

        return <div className="mx_MainSplit">
            { bodyView }
            { children }
        </div>;
    }
}

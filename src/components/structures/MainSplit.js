/*
Copyright 2018 New Vector Ltd

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
import ResizeHandle from '../views/elements/ResizeHandle';
import {Resizer, FixedDistributor} from '../../resizer';

export default class MainSplit extends React.Component {

    constructor(props) {
        super(props);
        this._setResizeContainerRef = this._setResizeContainerRef.bind(this);
    }

    _createResizer() {
        const classNames = {
            handle: "mx_ResizeHandle",
            vertical: "mx_ResizeHandle_vertical",
            reverse: "mx_ResizeHandle_reverse"
        };
        const resizer = new Resizer(
            this.resizeContainer,
            FixedDistributor);
        resizer.setClassNames(classNames);
        return resizer;
    }

    _setResizeContainerRef(div) {
        this.resizeContainer = div;
    }

    _loadResizerPreferences() {
        const rhsSize = window.localStorage.getItem("mx_rhs_size");
        if (rhsSize !== null) {
            this.resizer.forHandleAt(0).resize(parseInt(rhsSize, 10));
        }
    }

    componentDidMount() {
        this.resizer = this._createResizer();
        this.resizer.attach();
        this._loadResizerPreferences();
    }

    componentWillUnmount() {
        this.resizer.detach();
    }

    render() {
        const bodyView = React.Children.only(this.props.children);
        const panelView = this.props.panel;

        if (this.props.collapsedRhs || !panelView) {
            return bodyView;
        } else {
            return <div className="mx_MainSplit" ref={this._setResizeContainerRef}>
                { bodyView }
                <ResizeHandle reverse={true}/>
                { panelView }
            </div>;
        }
    }
};

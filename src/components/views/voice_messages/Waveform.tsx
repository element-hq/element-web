/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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
import {replaceableComponent} from "../../../utils/replaceableComponent";

interface IProps {
    relHeights: number[]; // relative heights (0-1)
}

interface IState {
}

/**
 * A simple waveform component. This renders bars (centered vertically) for each
 * height provided in the component properties. Updating the properties will update
 * the rendered waveform.
 */
@replaceableComponent("views.voice_messages.Waveform")
export default class Waveform extends React.PureComponent<IProps, IState> {
    public constructor(props) {
        super(props);
    }

    public render() {
        return <div className='mx_Waveform'>
            {this.props.relHeights.map((h, i) => {
                return <span key={i} style={{height: (h * 100) + '%'}} className='mx_Waveform_bar' />;
            })}
        </div>;
    }
}

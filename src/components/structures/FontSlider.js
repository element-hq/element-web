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

import React from 'react';
import PropTypes from 'prop-types';

export default class Slider extends React.Component {

    static propTypes = {
        // A callback for the new value onclick
        updateFontSize: PropTypes.func,

        // The current value of the slider
        value: PropTypes.number,

        // The range and values of the slider
        // Currently only supports an ascending, constant interval range
        values: PropTypes.arrayOf(PropTypes.number),

        // A function for formatting the the values
        displayFunc: PropTypes.func,
    };

    render() {
        let dots = this.props.values.map(v => 
            <Dot active={v<=this.props.value} 
                 label={this.props.displayFunc(v)} 
                 onClick={() => this.props.updateFontSize(v)}
                 key={v}
            />);

        let offset = this.offset(this.props.values, this.props.value);

        return <div className="mx_fontSlider">
            <div>
                <div className="mx_fontSlider_bar">
                    <hr />
                    <div className="mx_fontSlider_selection">
                        <div className="mx_fontSlider_selectionDot" style={{left: "calc(-0.55rem + " + offset + "%"}} />
                        <hr style={{width: offset + "%"}}/>
                    </div>
                </div>
                <div className="mx_fontSlider_dotContainer">
                    {dots}
                </div>
            </div>
        </div>
    }

    offset(values, value) {
        return  (value - values[0]) / (values[values.length - 1] - values[0]) * 100;
    }
}

class Dot extends React.Component {

    static propTypes = {
        // Callback for behaviour onclick
        onClick: PropTypes.func,

        // Whether the dot should appear active
        active: PropTypes.bool,

        // The label on the dot
        label: PropTypes.string,
    }

    render () {
        let className = "mx_fontSlider_dot" + (this.props.active? " mx_fontSlider_dotActive": "");

        return <span onClick={this.props.onClick} className="mx_fontSlider_dotValue">
            <div className={className} />
            <div>
                {this.props.label}
            </div>
        </span>
    }
}
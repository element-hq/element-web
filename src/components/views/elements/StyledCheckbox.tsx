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

import React from "react";
import { randomString } from "matrix-js-sdk/src/randomstring";

const CHECK_BOX_SVG = require("../../../../res/img/feather-customised/check.svg");

interface IProps extends React.InputHTMLAttributes<HTMLInputElement> {
}

interface IState {
}

export default class StyledCheckbox extends React.PureComponent<IProps, IState> {
    private id: string;

    public static readonly defaultProps = {
        className: "",
    };

    constructor(props: IProps) {
        super(props);
        // 56^10 so unlikely chance of collision.
        this.id = "checkbox_" + randomString(10);
    }

    public render() {
        const { children, className, ...otherProps } = this.props;
        return <span className={"mx_Checkbox " + className}>
            <input id={this.id} {...otherProps} type="checkbox" />
            <label htmlFor={this.id}>
                {/* Using the div to center the image */}
                <div className="mx_Checkbox_background">
                    <img src={CHECK_BOX_SVG}/>
                </div>
                <div>
                    { this.props.children }
                </div>
            </label>
        </span>;
    }
}
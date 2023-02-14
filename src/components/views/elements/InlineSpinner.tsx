/*
Copyright 2017 New Vector Ltd.

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

import { _t } from "../../../languageHandler";

interface IProps {
    w?: number;
    h?: number;
    children?: React.ReactNode;
}

export default class InlineSpinner extends React.PureComponent<IProps> {
    public static defaultProps = {
        w: 16,
        h: 16,
    };

    public render(): React.ReactNode {
        return (
            <div className="mx_InlineSpinner">
                <div
                    className="mx_InlineSpinner_icon mx_Spinner_icon"
                    style={{ width: this.props.w, height: this.props.h }}
                    aria-label={_t("Loading…")}
                >
                    {this.props.children}
                </div>
            </div>
        );
    }
}

/*
Copyright 2015-2021 The Matrix.org Foundation C.I.C.

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
    message?: string;
    onFinished: any; // XXX: Spinner pretends to be a dialog so it must accept an onFinished, but it never calls it
}

export default class Spinner extends React.PureComponent<IProps> {
    public static defaultProps: Partial<IProps> = {
        w: 32,
        h: 32,
    };

    public render(): React.ReactNode {
        const { w, h, message } = this.props;
        return (
            <div className="mx_Spinner">
                {message && (
                    <React.Fragment>
                        <div className="mx_Spinner_Msg">{message}</div>&nbsp;
                    </React.Fragment>
                )}
                <div
                    className="mx_Spinner_icon"
                    style={{ width: w, height: h }}
                    aria-label={_t("Loading…")}
                    role="progressbar"
                    data-testid="spinner"
                />
            </div>
        );
    }
}

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

import classNames from "classnames";
import React from "react";
import { _t } from "../../../languageHandler";
import { replaceableComponent } from "../../../utils/replaceableComponent";

interface IProps {
    reason: string;
}

interface IState {
    hidden: boolean;
}

@replaceableComponent("views.elements.InviteReason")
export default class InviteReason extends React.PureComponent<IProps, IState> {
    constructor(props) {
        super(props);
        this.state = {
            // We hide the reason for invitation by default, since it can be a
            // vector for spam/harassment.
            hidden: true,
        };
    }

    onViewClick = () => {
        this.setState({
            hidden: false,
        });
    }

    render() {
        const classes = classNames({
            "mx_InviteReason": true,
            "mx_InviteReason_hidden": this.state.hidden,
        });

        return <div className={classes}>
            <div className="mx_InviteReason_reason">{this.props.reason}</div>
            <div className="mx_InviteReason_view"
                onClick={this.onViewClick}
            >
                {_t("View message")}
            </div>
        </div>;
    }
}

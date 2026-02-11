/*
Copyright 2024 New Vector Ltd.
Copyright 2019 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React from "react";
import { type MatrixEvent, MatrixEventEvent } from "matrix-js-sdk/src/matrix";
import classNames from "classnames";
import { CollapseIcon, ExpandIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

import { MatrixClientPeg } from "../../../MatrixClientPeg";
import { _t } from "../../../languageHandler";
import AccessibleButton, { type ButtonEvent } from "../elements/AccessibleButton";

interface IProps {
    mxEvent: MatrixEvent;
}

interface IState {
    expanded: boolean;
}

export default class ViewSourceEvent extends React.PureComponent<IProps, IState> {
    public constructor(props: IProps) {
        super(props);

        this.state = {
            expanded: false,
        };
    }

    public componentDidMount(): void {
        const { mxEvent } = this.props;

        const client = MatrixClientPeg.safeGet();
        client.decryptEventIfNeeded(mxEvent);

        if (mxEvent.isBeingDecrypted()) {
            mxEvent.once(MatrixEventEvent.Decrypted, () => this.forceUpdate());
        }
    }

    private onToggle = (ev: ButtonEvent): void => {
        ev.preventDefault();
        const { expanded } = this.state;
        this.setState({
            expanded: !expanded,
        });
    };

    public render(): React.ReactNode {
        const { mxEvent } = this.props;
        const { expanded } = this.state;

        let content;
        if (expanded) {
            content = <pre>{JSON.stringify(mxEvent, null, 4)}</pre>;
        } else {
            content = <code>{`{ "type": ${mxEvent.getType()} }`}</code>;
        }

        const classes = classNames("mx_ViewSourceEvent mx_EventTile_content", {
            mx_ViewSourceEvent_expanded: expanded,
        });

        return (
            <span className={classes}>
                {content}
                <AccessibleButton
                    kind="link"
                    title={_t("devtools|toggle_event")}
                    className="mx_ViewSourceEvent_toggle"
                    onClick={this.onToggle}
                >
                    {expanded ? <CollapseIcon /> : <ExpandIcon />}
                </AccessibleButton>
            </span>
        );
    }
}

/*
 Copyright 2019 Sorunome

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

interface IProps {
    reason?: string;
    contentHtml: string;
}

interface IState {
    visible: boolean;
}

export default class Spoiler extends React.Component<IProps, IState> {
    public constructor(props: IProps) {
        super(props);
        this.state = {
            visible: false,
        };
    }

    private toggleVisible = (e: React.MouseEvent): void => {
        if (!this.state.visible) {
            // we are un-blurring, we don't want this click to propagate to potential child pills
            e.preventDefault();
            e.stopPropagation();
        }
        this.setState({ visible: !this.state.visible });
    };

    public render(): React.ReactNode {
        const reason = this.props.reason ? (
            <span className="mx_EventTile_spoiler_reason">{"(" + this.props.reason + ")"}</span>
        ) : null;
        // react doesn't allow appending a DOM node as child.
        // as such, we pass the this.props.contentHtml instead and then set the raw
        // HTML content. This is secure as the contents have already been parsed previously
        return (
            <span
                className={"mx_EventTile_spoiler" + (this.state.visible ? " visible" : "")}
                onClick={this.toggleVisible}
            >
                {reason}
                &nbsp;
                <span
                    className="mx_EventTile_spoiler_content"
                    dangerouslySetInnerHTML={{ __html: this.props.contentHtml }}
                />
            </span>
        );
    }
}

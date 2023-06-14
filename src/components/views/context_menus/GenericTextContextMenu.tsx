/*
Copyright 2017 Michael Telatynski <7t3chguy@gmail.com>

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
    message: string;
}

export default class GenericTextContextMenu extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_Tooltip mx_Tooltip_visible" style={{ display: "block" }}>
                {this.props.message}
            </div>
        );
    }
}

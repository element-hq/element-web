/*
Copyright 2015, 2016 OpenMarket Ltd
Copyright 2019 New Vector Ltd

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

import AuthHeaderLogo from "./AuthHeaderLogo";
import LanguageSelector from "./LanguageSelector";

interface IProps {
    disableLanguageSelector?: boolean;
}

export default class AuthHeader extends React.Component<IProps> {
    public render(): React.ReactNode {
        return (
            <div className="mx_AuthHeader">
                <AuthHeaderLogo />
                <LanguageSelector disabled={this.props.disableLanguageSelector} />
            </div>
        );
    }
}

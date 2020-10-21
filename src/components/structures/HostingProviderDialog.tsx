/*
Copyright 2020 Element

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

import * as React from "react";
import SdkConfig from "../../SdkConfig";

interface IProps {}

interface IState {}

export default class HostingProviderDialog extends React.PureComponent<IProps, IState> {
    public render(): React.ReactNode {
        const hostingSignupUrl = SdkConfig.get().hosting_signup_iframe;
        return (
            <div className="mx_HostingProviderDialog_container">
                <iframe src={hostingSignupUrl} />
            </div>
        );
    }
}

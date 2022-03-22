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

import * as React from "react";

import AutoHideScrollbar from './AutoHideScrollbar';
import { _t } from "../../languageHandler";
import SdkConfig, { DEFAULTS } from "../../SdkConfig";

interface IProps {
    groupId: string;
}

const LegacyGroupView: React.FC<IProps> = ({ groupId }) => {
    // XXX: Stealing classes from the HomePage component for CSS simplicity.
    // XXX: Inline CSS because this is all temporary
    const learnMoreUrl = SdkConfig.get().spaces_learn_more_url ?? DEFAULTS.spaces_learn_more_url;
    return <AutoHideScrollbar className="mx_HomePage mx_HomePage_default">
        <div className="mx_HomePage_default_wrapper">
            <h1 style={{ fontSize: '24px' }}>{ _t("That link is no longer supported") }</h1>
            <p>
                { _t(
                    "You're trying to access a community link (%(groupId)s).<br/>" +
                    "Communities are no longer supported and have been replaced by spaces.<br2/>" +
                    "<a>Learn more about spaces here.</a>",
                    { groupId },
                    {
                        br: () => <br />,
                        br2: () => <br />,
                        a: (sub) => <a href={learnMoreUrl} rel="noreferrer noopener" target="_blank">{ sub }</a>,
                    },
                ) }
            </p>
        </div>
    </AutoHideScrollbar>;
};

export default LegacyGroupView;

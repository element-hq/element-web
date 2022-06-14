/*
Copyright 2022 The Matrix.org Foundation C.I.C.

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

import Modal from "./Modal";
import QuestionDialog from "./components/views/dialogs/QuestionDialog";
import { _t } from "./languageHandler";
import SdkConfig, { DEFAULTS } from "./SdkConfig";

export function showGroupReplacedWithSpacesDialog(groupId: string) {
    const learnMoreUrl = SdkConfig.get().spaces_learn_more_url ?? DEFAULTS.spaces_learn_more_url;
    Modal.createDialog(QuestionDialog, {
        title: _t("That link is no longer supported"),
        description: <>
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
        </>,
        hasCancelButton: false,
    });
}

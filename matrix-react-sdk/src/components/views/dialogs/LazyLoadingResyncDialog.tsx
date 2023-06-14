/*
Copyright 2018 New Vector Ltd
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

import React from "react";

import QuestionDialog from "./QuestionDialog";
import { _t } from "../../../languageHandler";
import SdkConfig from "../../../SdkConfig";

interface IProps {
    onFinished(): void;
}

const LazyLoadingResyncDialog: React.FC<IProps> = (props) => {
    const brand = SdkConfig.get().brand;
    const description = _t(
        "%(brand)s now uses 3-5x less memory, by only loading information " +
            "about other users when needed. Please wait whilst we resynchronise " +
            "with the server!",
        { brand },
    );

    return (
        <QuestionDialog
            hasCancelButton={false}
            title={_t("Updating %(brand)s", { brand })}
            description={<div>{description}</div>}
            button={_t("OK")}
            onFinished={props.onFinished}
        />
    );
};

export default LazyLoadingResyncDialog;

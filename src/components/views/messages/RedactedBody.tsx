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

import React, {useContext} from "react";
import {MatrixClient} from "matrix-js-sdk/src/client";
import {MatrixEvent} from "matrix-js-sdk/src/models/event";
import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import {formatFullDate} from "../../../DateUtils";
import SettingsStore from "../../../settings/SettingsStore";

interface IProps {
    mxEvent: MatrixEvent;
}

const RedactedBody = React.forwardRef<any, IProps>(({mxEvent}, ref) => {
    const cli: MatrixClient = useContext(MatrixClientContext);

    let text = _t("Message deleted");
    const unsigned = mxEvent.getUnsigned();
    const redactedBecauseUserId = unsigned && unsigned.redacted_because && unsigned.redacted_because.sender;
    if (redactedBecauseUserId && redactedBecauseUserId !== mxEvent.getSender()) {
        const room = cli.getRoom(mxEvent.getRoomId());
        const sender = room && room.getMember(redactedBecauseUserId);
        text = _t("Message deleted by %(name)s", { name: sender ? sender.name : redactedBecauseUserId });
    }

    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const fullDate = formatFullDate(new Date(unsigned.redacted_because.origin_server_ts), showTwelveHour);
    const titleText = _t("Message deleted on %(date)s", { date: fullDate });

    return (
        <span className="mx_RedactedBody" ref={ref} title={titleText}>
            { text }
        </span>
    );
});

export default RedactedBody;

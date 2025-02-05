/*
Copyright 2024 New Vector Ltd.
Copyright 2020, 2021 The Matrix.org Foundation C.I.C.

SPDX-License-Identifier: AGPL-3.0-only OR GPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE files in the repository root for full details.
*/

import React, { type ForwardRefExoticComponent, useContext } from "react";
import { type MatrixClient } from "matrix-js-sdk/src/matrix";

import { _t } from "../../../languageHandler";
import MatrixClientContext from "../../../contexts/MatrixClientContext";
import { formatFullDate } from "../../../DateUtils";
import SettingsStore from "../../../settings/SettingsStore";
import { type IBodyProps } from "./IBodyProps";

const RedactedBody = React.forwardRef<any, IBodyProps>(({ mxEvent }, ref) => {
    const cli: MatrixClient = useContext(MatrixClientContext);
    let text = _t("timeline|self_redaction");
    const unsigned = mxEvent.getUnsigned();
    const redactedBecauseUserId = unsigned && unsigned.redacted_because && unsigned.redacted_because.sender;
    if (redactedBecauseUserId && redactedBecauseUserId !== mxEvent.getSender()) {
        const room = cli.getRoom(mxEvent.getRoomId());
        const sender = room && room.getMember(redactedBecauseUserId);
        text = _t("timeline|redaction", { name: sender ? sender.name : redactedBecauseUserId });
    }

    const showTwelveHour = SettingsStore.getValue("showTwelveHourTimestamps");
    const fullDate = unsigned.redacted_because
        ? formatFullDate(new Date(unsigned.redacted_because.origin_server_ts), showTwelveHour)
        : undefined;
    const titleText = fullDate ? _t("timeline|redacted|tooltip", { date: fullDate }) : undefined;

    return (
        <span className="mx_RedactedBody" ref={ref} title={titleText}>
            {text}
        </span>
    );
}) as ForwardRefExoticComponent<IBodyProps>;

export default RedactedBody;

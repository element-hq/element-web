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

import React, { FC, useState, useEffect, memo } from "react";
import { GroupCall } from "matrix-js-sdk/src/webrtc/groupCall";

import { formatPreciseDuration } from "../../../DateUtils";

interface CallDurationProps {
    delta: number;
}

/**
 * A call duration counter.
 */
export const CallDuration: FC<CallDurationProps> = memo(({ delta }) => {
    // Clock desync could lead to a negative duration, so just hide it if that happens
    if (delta <= 0) return null;
    return <div className="mx_CallDuration">{formatPreciseDuration(delta)}</div>;
});

interface GroupCallDurationProps {
    groupCall: GroupCall;
}

/**
 * A call duration counter that automatically counts up, given a live GroupCall
 * object.
 */
export const GroupCallDuration: FC<GroupCallDurationProps> = ({ groupCall }) => {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    return groupCall.creationTs === null ? null : <CallDuration delta={now - groupCall.creationTs} />;
};

/*
Copyright 2021 The Matrix.org Foundation C.I.C.

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

import React, { useState } from 'react';
import HostSignupDialog from "../dialogs/HostSignupDialog";
import { HostSignupStore } from "../../../stores/HostSignupStore";
import { useEventEmitter } from "../../../hooks/useEventEmitter";
import { UPDATE_EVENT } from "../../../stores/AsyncStore";

const HostSignupContainer = () => {
    const [isActive, setIsActive] = useState(HostSignupStore.instance.isHostSignupActive);
    useEventEmitter(HostSignupStore.instance, UPDATE_EVENT, () => {
        setIsActive(HostSignupStore.instance.isHostSignupActive);
    });

    return <div className="mx_HostSignupContainer">
        {isActive &&
            <HostSignupDialog />
        }
    </div>;
};

export default HostSignupContainer

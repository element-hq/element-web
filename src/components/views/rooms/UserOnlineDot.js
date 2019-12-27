/*
Copyright 2019 The Matrix.org Foundation C.I.C.

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

import React, {useContext, useEffect, useMemo, useState, useCallback} from "react";
import PropTypes from "prop-types";

import {useEventEmitter} from "../../../hooks/useEventEmitter";
import MatrixClientContext from "../../../contexts/MatrixClientContext";

const UserOnlineDot = ({userId}) => {
    const cli = useContext(MatrixClientContext);
    const user = useMemo(() => cli.getUser(userId), [cli, userId]);

    const [isOnline, setIsOnline] = useState(false);

    // Recheck if the user or client changes
    useEffect(() => {
        setIsOnline(user && (user.currentlyActive || user.presence === "online"));
    }, [cli, user]);
    // Recheck also if we receive a User.currentlyActive event
    const currentlyActiveHandler = useCallback((ev) => {
        const content = ev.getContent();
        setIsOnline(content.currently_active || content.presence === "online");
    }, []);
    useEventEmitter(user, "User.currentlyActive", currentlyActiveHandler);
    useEventEmitter(user, "User.presence", currentlyActiveHandler);

    return isOnline ? <span className="mx_UserOnlineDot" /> : null;
};

UserOnlineDot.propTypes = {
    userId: PropTypes.string.isRequired,
};

export default UserOnlineDot;

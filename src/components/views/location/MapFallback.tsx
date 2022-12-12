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

import React from "react";
import classNames from "classnames";

import { Icon as LocationMarkerIcon } from "../../../../res/img/element-icons/location.svg";
import { Icon as MapFallbackImage } from "../../../../res/img/location/map.svg";
import Spinner from "../elements/Spinner";

interface Props extends React.HTMLAttributes<HTMLDivElement> {
    className?: string;
    isLoading?: boolean;
    children?: React.ReactNode | React.ReactNodeArray;
}

const MapFallback: React.FC<Props> = ({ className, isLoading, children, ...rest }) => {
    return (
        <div className={classNames("mx_MapFallback", className)} {...rest}>
            <MapFallbackImage className="mx_MapFallback_bg" />
            {isLoading ? <Spinner h={32} w={32} /> : <LocationMarkerIcon className="mx_MapFallback_icon" />}
            {children}
        </div>
    );
};

export default MapFallback;

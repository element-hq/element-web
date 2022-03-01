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

import React, { SyntheticEvent, useContext } from 'react';
import { Room } from 'matrix-js-sdk/src/models/room';

import MatrixClientContext from '../../../contexts/MatrixClientContext';
import ContextMenu, { AboveLeftOf } from '../../structures/ContextMenu';
import LocationPicker, { ILocationPickerProps } from "./LocationPicker";
import { shareLocation } from './shareLocation';

type Props = Omit<ILocationPickerProps, 'onChoose'> & {
    onFinished: (ev?: SyntheticEvent) => void;
    menuPosition: AboveLeftOf;
    openMenu: () => void;
    roomId: Room["roomId"];
};

const LocationShareMenu: React.FC<Props> = ({
    menuPosition, onFinished, sender, roomId, openMenu,
}) => {
    const matrixClient = useContext(MatrixClientContext);

    return <ContextMenu
        {...menuPosition}
        onFinished={onFinished}
        managed={false}
    >
        <div className="mx_LocationShareMenu">
            <LocationPicker
                sender={sender}
                onChoose={shareLocation(matrixClient, roomId, openMenu)}
                onFinished={onFinished}
            />
        </div>
    </ContextMenu>;
};

export default LocationShareMenu;

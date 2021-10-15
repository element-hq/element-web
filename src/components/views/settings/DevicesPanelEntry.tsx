/*
Copyright 2016 - 2021 The Matrix.org Foundation C.I.C.

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

import React from 'react';
import { IMyDevice } from 'matrix-js-sdk/src/client';

import { _t } from '../../../languageHandler';
import { MatrixClientPeg } from '../../../MatrixClientPeg';
import { formatDate } from '../../../DateUtils';
import StyledCheckbox from '../elements/StyledCheckbox';
import { replaceableComponent } from "../../../utils/replaceableComponent";
import EditableTextContainer from "../elements/EditableTextContainer";

import { logger } from "matrix-js-sdk/src/logger";

interface IProps {
    device?: IMyDevice;
    onDeviceToggled?: (device: IMyDevice) => void;
    selected?: boolean;
}

@replaceableComponent("views.settings.DevicesPanelEntry")
export default class DevicesPanelEntry extends React.Component<IProps> {
    public static defaultProps = {
        onDeviceToggled: () => {},
    };

    private onDisplayNameChanged = (value: string): Promise<{}> => {
        const device = this.props.device;
        return MatrixClientPeg.get().setDeviceDetails(device.device_id, {
            display_name: value,
        }).catch((e) => {
            logger.error("Error setting session display name", e);
            throw new Error(_t("Failed to set display name"));
        });
    };

    private onDeviceToggled = (): void => {
        this.props.onDeviceToggled(this.props.device);
    };

    public render(): JSX.Element {
        const device = this.props.device;

        let lastSeen = "";
        if (device.last_seen_ts) {
            const lastSeenDate = formatDate(new Date(device.last_seen_ts));
            lastSeen = device.last_seen_ip + " @ " +
                lastSeenDate.toLocaleString();
        }

        let myDeviceClass = '';
        if (device.device_id === MatrixClientPeg.get().getDeviceId()) {
            myDeviceClass = " mx_DevicesPanel_myDevice";
        }

        return (
            <tr className={"mx_DevicesPanel_device" + myDeviceClass}>
                <td className="mx_DevicesPanel_deviceId">
                    { device.device_id }
                </td>
                <td className="mx_DevicesPanel_deviceName">
                    <EditableTextContainer initialValue={device.display_name}
                        onSubmit={this.onDisplayNameChanged}
                        placeholder={device.device_id}
                    />
                </td>
                <td className="mx_DevicesPanel_lastSeen">
                    { lastSeen }
                </td>
                <td className="mx_DevicesPanel_deviceButtons">
                    <StyledCheckbox onChange={this.onDeviceToggled} checked={this.props.selected} />
                </td>
            </tr>
        );
    }
}

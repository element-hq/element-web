import { MatrixClientPeg } from "matrix-react-sdk/src/MatrixClientPeg";
import React, { ReactElement } from 'react';
import * as sdk from 'matrix-react-sdk';

export function screenshotDevicesPanel2Devices(): ReactElement {
    MatrixClientPeg.get().getDevices = get2Devices;
    const DevicesPanel = sdk.getComponent('views.settings.DevicesPanel');
    return <DevicesPanel />;
}

async function get2Devices() {
    return {
        devices: [
            {
                device_id: "ABCDEFGHIJ",
                display_name: "Element Firefox",
                last_seen_ip: "123.45.67.8",
                last_seen_ts: 1582772521000,
            },
            {
                device_id: "KLMNOPQRST",
                display_name: "Element Android",
                last_seen_ip: "123.45.67.9",
                last_seen_ts: 1580443506000,
            },
        ],
    };
}

import dis from './dispatcher';
import sdk from './index';
import Modal from './Modal';

const onAction = function(payload) {
    if (payload.action === 'unknown_device_error') {
        var UnknownDeviceDialog = sdk.getComponent("dialogs.UnknownDeviceDialog");
        Modal.createDialog(UnknownDeviceDialog, {
            devices: payload.err.devices,
            room: payload.room,
            onFinished: (r) => {
                // XXX: temporary logging to try to diagnose
                // https://github.com/vector-im/riot-web/issues/3148
                console.log('UnknownDeviceDialog closed with '+r);
            },
        }, "mx_Dialog_unknownDevice");
    }
}

let ref = null;

export function startListening () {
    ref = dis.register(onAction);
}

export function stopListening () {
    if (ref) {
        dis.unregister(ref);
        ref = null;
    }
}

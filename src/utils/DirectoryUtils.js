// Find a protocol 'instance' with a given instance_id
// in the supplied protocols dict
export function instanceForInstanceId(protocols, instance_id) {
    if (!instance_id) return null;
    for (const proto of Object.keys(protocols)) {
        if (!protocols[proto].instances && protocols[proto].instances instanceof Array) continue;
        for (const instance of protocols[proto].instances) {
            if (instance.instance_id == instance_id) return instance;
        }
    }
}

// given an instance_id, return the name of the protocol for
// that instance ID in the supplied protocols dict
export function protocolNameForInstanceId(protocols, instance_id) {
    if (!instance_id) return null;
    for (const proto of Object.keys(protocols)) {
        if (!protocols[proto].instances && protocols[proto].instances instanceof Array) continue;
        for (const instance of protocols[proto].instances) {
            if (instance.instance_id == instance_id) return proto;
        }
    }
}

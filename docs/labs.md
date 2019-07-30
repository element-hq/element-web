# Labs features

Some notes on the features you can enable by going to `Settings->Labs`. Not exhaustive, chat in
[#riot-web:matrix.org] for more information.

**Be warned! Labs features are not finalised, they may be fragile, they may change, they may be
dropped. Ask in the room if you are unclear about any details here.**

## Render simple counters in room header

Allows rendering of labelled counters above the message list.

Once enabled, send a custom state event to a room to set values:

1. In a room, type `/devtools` to bring up the devtools interface
2. Click "Send Custom Event"
3. Toggle from "Event" to "State Event"
4. Set the event type to: `re.jki.counter` and give it a unique key
5. Specify the content in the following format:

```
{
    "link": "",
    "severity": "normal",
    "title": "my counter",
    "value": 0
}
```

That's it. Now should see your new counter under the header.

## Bridge Errors

`feature_bridge_errors` shows errors from bridges in the room. These errors
are emitted for an event when it couldn't be delivered to users bridged into
the room. The feature is currently proposed as a MSC and will be subject to
change.

[#riot-web:matrix.org]: https://matrix.to/#/#riot-web:matrix.org

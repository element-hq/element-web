# Local echo (developer docs)

The React SDK provides some local echo functionality to allow for components to do something
quickly and fall back when it fails. This is all available in the `local-echo` directory within
`stores`.

Echo is handled in EchoChambers, with `GenericEchoChamber` being the base implementation for all
chambers. The `EchoChamber` class is provided as semantic access to a `GenericEchoChamber`
implementation, such as the `RoomEchoChamber` (which handles echoable details of a room).

Anything that can be locally echoed will be provided by the `GenericEchoChamber` implementation.
The echo chamber will also need to deal with external changes, and has full control over whether
or not something has successfully been echoed.

An `EchoContext` is provided to echo chambers (usually with a matching type: `RoomEchoContext`
gets provided to a `RoomEchoChamber` for example) with details about their intended area of
effect, as well as manage `EchoTransaction`s. An `EchoTransaction` is simply a unit of work that
needs to be locally echoed.

The `EchoStore` manages echo chamber instances, builds contexts, and is generally less semantically
accessible than the `EchoChamber` class. For separation of concerns, and to try and keep things
tidy, this is an intentional design decision.

**Note**: The local echo stack uses a "whenable" pattern, which is similar to thenables and
`EventEmitter`. Whenables are ways of actioning a changing condition without having to deal
with listeners being torn down. Once the reference count of the Whenable causes garbage collection,
the Whenable's listeners will also be torn down. This is accelerated by the `IDestroyable` interface
usage.

## Audit functionality

The UI supports a "Server isn't responding" dialog which includes a partial audit log-like
structure to it. This is partially the reason for added complexity of `EchoTransaction`s
and `EchoContext`s - this information feeds the UI states which then provide direct retry
mechanisms.

The `EchoStore` is responsible for ensuring that the appropriate non-urgent toast (lower left)
is set up, where the dialog then drives through the contexts and transactions.

# Room list sorting

It's so complicated it needs its own README.

## Algorithms involved

There's two main kinds of algorithms involved in the room list store: list ordering and tag sorting.
Throughout the code an intentional decision has been made to call them the List Algorithm and Sorting
Algorithm respectively. The list algorithm determines the behaviour of the room list whereas the sorting
algorithm determines how rooms get ordered within tags affected by the list algorithm.

Behaviour of the room list takes the shape of determining what features the room list supports, as well
as determining where and when to apply the sorting algorithm in a tag. The importance algorithm, which
is described later in this doc, is an example of an algorithm which makes heavy behavioural changes
to the room list.

Tag sorting is effectively the comparator supplied to the list algorithm. This gives the list algorithm
the power to decide when and how to apply the tag sorting, if at all.

### Tag sorting algorithm: Alphabetical

When used, rooms in a given tag will be sorted alphabetically, where the alphabet's order is a problem
for the browser. All we do is a simple string comparison and expect the browser to return something
useful.

### Tag sorting algorithm: Manual

Manual sorting makes use of the `order` property present on all tags for a room, per the 
[Matrix specification](https://matrix.org/docs/spec/client_server/r0.6.0#room-tagging). Smaller values
of `order` cause rooms to appear closer to the top of the list.

### Tag sorting algorithm: Recent

Rooms get ordered by the timestamp of the most recent useful message. Usefulness is yet another algorithm
in the room list system which determines whether an event type is capable of bubbling up in the room list.
Normally events like room messages, stickers, and room security changes will be considered useful enough
to cause a shift in time.

Note that this is reliant on the event timestamps of the most recent message. Because Matrix is eventually
consistent this means that from time to time a room might plummet or skyrocket across the tag due to the
timestamp contained within the event (generated server-side by the sender's server).

### List ordering algorithm: Natural

This is the easiest of the algorithms to understand because it does essentially nothing. It imposes no
behavioural changes over the tag sorting algorithm and is by far the simplest way to order a room list.
Historically, it's been the only option in Riot and extremely common in most chat applications due to
its relative deterministic behaviour.

### List ordering algorithm: Importance

On the other end of the spectrum, this is the most complicated algorithm which exists. There's major
behavioural changes, and the tag sorting algorithm gets selectively applied depending on circumstances.

Each tag which is not manually ordered gets split into 4 sections or "categories". Manually ordered tags
simply get the manual sorting algorithm applied to them with no further involvement from the importance
algorithm. There are 4 categories: Red, Grey, Bold, and Idle. Each has their own definition based off
relative (perceived) importance to the user:

* **Red**: The room has unread mentions waiting for the user.
* **Grey**: The room has unread notifications waiting for the user. Notifications are simply unread
  messages which cause a push notification or badge count. Typically, this is the default as rooms get
  set to 'All Messages'.
* **Bold**: The room has unread messages waiting for the user. Essentially this is a grey room without
  a badge/notification count (or 'Mentions Only'/'Muted').
* **Idle**: No useful (see definition of useful above) activity has occurred in the room since the user 
  last read it.

Conveniently, each tag gets ordered by those categories as presented: red rooms appear above grey, grey
above bold, etc.

Once the algorithm has determined which rooms belong in which categories, the tag sorting algorithm
gets applied to each category in a sub-sub-list fashion. This should result in the red rooms (for example)
being sorted alphabetically amongst each other as well as the grey rooms sorted amongst each other, but 
collectively the tag will be sorted into categories with red being at the top.

### Sticky rooms

When the user visits a room, that room becomes 'sticky' in the list, regardless of ordering algorithm.
From a code perspective, the underlying algorithm is not aware of a sticky room and instead the base class
manages which room is sticky. This is to ensure that all algorithms handle it the same.

The sticky flag is simply to say it will not move higher or lower down the list while it is active. For
example, if using the importance algorithm, the room would naturally become idle once viewed and thus
would normally fly down the list out of sight. The sticky room concept instead holds it in place, never
letting it fly down until the user moves to another room.

Only one room can be sticky at a time. Room updates around the sticky room will still hold the sticky
room in place. The best example of this is the importance algorithm: if the user has 3 red rooms and
selects the middle room, they will see exactly one room above their selection at all times. If they
receive another notification which causes the room to move into the topmost position, the room that was
above the sticky room will move underneath to allow for the new room to take the top slot, maintaining
the sticky room's position.

Though only applicable to the importance algorithm, the sticky room is not aware of category boundaries 
and thus the user can see a shift in what kinds of rooms move around their selection. An example would 
be the user having 4 red rooms, the user selecting the third room (leaving 2 above it), and then having 
the rooms above it read on another device. This would result in 1 red room and 1 other kind of room 
above the sticky room as it will try to maintain 2 rooms above the sticky room.

An exception for the sticky room placement is when there's suddenly not enough rooms to maintain the placement
exactly. This typically happens if the user selects a room and leaves enough rooms where it cannot maintain
the N required rooms above the sticky room. In this case, the sticky room will simply decrease N as needed.
The N value will never increase while selection remains unchanged: adding a bunch of rooms after having 
put the sticky room in a position where it's had to decrease N will not increase N.

## Responsibilities of the store

The store is responsible for the ordering, upkeep, and tracking of all rooms. The room list component simply gets 
an object containing the tags it needs to worry about and the rooms within. The room list component will 
decide which tags need rendering (as it commonly filters out empty tags in most cases), and will deal with 
all kinds of filtering.

## Filtering

Filters are provided to the store as condition classes, which are then passed along to the algorithm
implementations. The implementations then get to decide how to actually filter the rooms, however in
practice the base `Algorithm` class deals with the filtering in a more optimized/generic way.

The results of filters get cached to avoid needlessly iterating over potentially thousands of rooms,
as the old room list store does. When a filter condition changes, it emits an update which (in this
case) the `Algorithm` class will pick up and act accordingly. Typically, this also means filtering a 
minor subset where possible to avoid over-iterating rooms.

All filter conditions are considered "stable" by the consumers, meaning that the consumer does not
expect a change in the condition unless the condition says it has changed. This is intentional to
maintain the caching behaviour described above.

## Class breakdowns

The `RoomListStore` is the major coordinator of various `Algorithm` implementations, which take care 
of the various `ListAlgorithm` and `SortingAlgorithm` options. The `Algorithm` superclass is also 
responsible for figuring out which tags get which rooms, as Matrix specifies them as a reverse map: 
tags get defined on rooms and are not defined as a collection of rooms (unlike how they are presented 
to the user). Various list-specific utilities are also included, though they are expected to move 
somewhere more general when needed. For example, the `membership` utilities could easily be moved 
elsewhere as needed.

The various bits throughout the room list store should also have jsdoc of some kind to help describe
what they do and how they work.

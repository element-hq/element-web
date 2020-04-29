# Room list sorting

It's so complicated it needs its own README.

## Algorithms involved

There's two main kinds of algorithms involved in the room list store: list ordering and tag sorting.
Throughout the code an intentional decision has been made to call them the List Algorithm and Sorting
Algorithm respectively. The list algorithm determines the behaviour of the room list whereas the sorting
algorithm determines how individual tags (lists of rooms, sometimes called sublists) are ordered.

Behaviour of the room list takes the shape of default sorting on tags in most cases, though it can
override what is happening at the tag level depending on the algorithm used (as is the case with the
importance algorithm, described later).

Tag sorting is effectively the comparator supplied to the list algorithm. This gives the list algorithm
the power to decide when and how to apply the tag sorting, if at all.

### Tag sorting algorithm: Alphabetical

When used, rooms in a given tag will be sorted alphabetically, where the alphabet is determined by a
simple string comparison operation (essentially giving the browser the problem of figuring out if A
comes before Z).

### Tag sorting algorithm: Manual

Manual sorting makes use of the `order` property present on all tags for a room, per the 
[Matrix specification](https://matrix.org/docs/spec/client_server/r0.6.0#room-tagging). Smaller values
of `order` cause rooms to appear closer to the top of the list.

### Tag sorting algorithm: Recent

Rooms are ordered by the timestamp of the most recent useful message. Usefulness is yet another algorithm
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
behavioural changes and the tag sorting algorithm is selectively applied depending on circumstances.

Each tag which is not manually ordered gets split into 4 sections or "categories". Manually ordered tags
simply get the manual sorting algorithm applied to them with no further involvement from the importance
algorithm. There are 4 categories: Red, Grey, Bold, and Idle. Each has their own definition based off
relative (perceived) importance to the user:

* **Red**: The room has unread mentions waiting for the user.
* **Grey**: The room has unread notifications waiting for the user. Notifications are simply unread
  messages which cause a push notification or badge count. Typically this is the default as rooms are
  set to 'All Messages'.
* **Bold**: The room has unread messages waiting for the user. Essentially this is a grey room without
  a badge/notification count (or 'Mentions Only'/'Muted').
* **Idle**: No relevant activity has occurred in the room since the user last read it.

Conveniently, each tag is ordered by those categories as presented: red rooms appear above grey, grey
above idle, etc.

Once the algorithm has determined which rooms belong in which categories, the tag sorting algorithm
is applied to each category in a sub-sub-list fashion. This should result in the red rooms (for example)
being sorted alphabetically amongst each other and the grey rooms sorted amongst each other, but 
collectively the tag will be sorted into categories with red being at the top.

The algorithm also has a concept of a 'sticky' room which is the room the user is currently viewing.
The sticky room will remain in position on the room list regardless of other factors going on as typically
clicking on a room will cause it to change categories into 'idle'. This is done by preserving N rooms
above the selected room at all times where N is the number of rooms above the selected rooms when it was
selected.

For example, if the user has 3 red rooms and selects the middle room, they will always see exactly one
room above their selection at all times. If they receive another notification and the tag ordering is set
to Recent, they'll see the new notification go to the top position and the one that was previously there
fall behind the sticky room.

The sticky room's category is technically 'idle' while being viewed and is explicitly pulled out of the
tag sorting algorithm's input as it must maintain its position in the list. When the user moves to another
room, the previous sticky room is recalculated to determine which category it needs to be in as the user
could have been scrolled up while new messages were received.

Further, the sticky room is not aware of category boundaries and thus the user can see a shift in what 
kinds of rooms move around their selection. An example would be the user having 4 red rooms, the user 
selecting the third room (leaving 2 above it), and then having the rooms above it read on another device. 
This would result in 1 red room and 1 other kind of room above the sticky room as it will try to maintain 
2 rooms above the sticky room.

An exception for the sticky room placement is when there's suddenly not enough rooms to maintain the placement
exactly. This typically happens if the user selects a room and leaves enough rooms where it cannot maintain
the N required rooms above the sticky room. In this case, the sticky room will simply decrease N as needed.
The N value will never increase while selection remains unchanged: adding a bunch of rooms after having 
put the sticky room in a position where it's had to decrease N will not increase N.

## Responsibilities of the store

The store is responsible for the ordering, upkeep, and tracking of all rooms. The component simply gets 
an object containing the tags it needs to worry about and the rooms within. The room list component will 
decide which tags need rendering (as it commonly filters out empty tags in most cases), and will deal with 
all kinds of filtering.

## Class breakdowns

The `RoomListStore` is the major coordinator of various `IAlgorithm` implementations, which take care 
of the various `ListAlgorithm` and `SortingAlgorithm` options. A `TagManager` is responsible for figuring 
out which tags get which rooms, as Matrix specifies them as a reverse map: tags are defined on rooms and 
are not defined as a collection of rooms (unlike how they are presented to the user). Various list-specific 
utilities are also included, though they are expected to move somewhere more general when needed. For 
example, the `membership` utilities could easily be moved elsewhere as needed.

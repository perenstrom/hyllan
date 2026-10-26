# Hyllan

Hyllan is a multi-tenant pantry inventory app: households sign up, then track what pantry items they have and how much of each.

## Language

**Household**:
The tenant boundary — created automatically for a user at signup, and strictly single-member: no invite or join mechanism exists, and there is no path for a second user to belong to the same household. Modeled as a distinct entity (not folded into the user account) so the domain language doesn't have to change if shared households are ever introduced. Owns a set of pantry items; deleting the owning user's account cascade-deletes the household and all its pantry items immediately — there is no grace period or soft-delete. Has no name field; the product refers to it as "your pantry," not by a household name.

**Pantry item**:
Something a household tracks having some quantity of. Identified within its household by `name`, case-insensitively — a household cannot have two pantry items with the same name. Adding an item under a name that already exists in the household increments that item's quantity rather than creating a second item, but only when the add's unit matches the existing item's unit; a unit mismatch rejects the add instead of merging (see ADR 0001). A pantry item's identity stays singular even once split across Locations — see Quantity.
_Avoid_: Product, ingredient, stock entry

**Barcode registration**:
A household-scoped mapping from a scanned barcode's value to one of its pantry items, created when a household links a barcode to an item. A pantry item can carry several barcode registrations (e.g. one per pack size or variant); a barcode value resolves to at most one pantry item within a household at a time. Each registration also says how much one scan of that barcode adds or removes, in the pantry item's own unit (e.g. 500 for a 500 g bag of an item tracked in g; defaults to 1). A household can remove a single registration, or change how much one scan of it adds or removes, from its pantry item without the package in hand. Deleting the pantry item a barcode is registered to deletes the registration with it (see ADR 0007).
_Avoid_: barcode, product code, UPC, EAN, GTIN

**Quantity**:
The decimal amount of a pantry item a household currently has, shown as a single total but tracked as the sum of that item's amounts across its Locations. Zero is valid and means the item is still tracked with none on hand (Out of stock or Empty, depending on its minimum quantity); negative values are invalid. Carries no unit-conversion behavior — see Unit. Incrementing/decrementing acts on a Location's amount, not on the item's total directly.

**Location**:
A place within a household's pantry (e.g. "Pantry", "Garage fridge") that a pantry item's quantity can be broken out across. Household-managed: a household creates, renames, and deletes its own locations rather than choosing from a fixed list. Identified within its household by `name`, case-insensitively, same rule as Pantry item — a household cannot have two locations with the same name. Assigning a location to an item is optional — an item's quantity can sit in an implicit unassigned bucket with no Location at all. An item can carry at most one quantity per Location (no duplicate rows for the same item/Location pair). Deleting a Location folds any quantity it held back into the owning item's unassigned bucket rather than discarding it. Moving an item's amount to another Location (by editing it) adds that amount to whatever that Location already holds for the item — it never overwrites it.
_Avoid_: place, room, area, stock entry

**Bucket**:
A code-facing term for one pantry item's quantity at one Location, or at the implicit unassigned bucket — one `item_locations` row. An item's Quantity is the sum of its buckets. Every write to a bucket goes through the Quantity module (`src/lib/quantity.ts`).
_Avoid_: stock entry

**Stock take**:
A household-initiated pass over a single Location's pantry items, correcting each item's quantity at that Location to an observed count — used when a use or addition never got logged. Sets quantity directly as an absolute count (not a delta), and can assign a quantity to an item not yet recorded at that Location, but never touches the item's rows at other Locations and cannot create a new pantry item.
_Avoid_: inventory count, audit, reconciliation, stock entry

**Minimum quantity**:
An optional, per-pantry-item positive amount in the item's own `unit` (see Unit): the least the household wants to have on hand, so an item is fine at exactly its minimum and needs restocking only once its quantity drops below it. Setting one says "I restock this"; leaving it unset says the household doesn't restock this item on a schedule, so it never needs restocking however low it runs. Determines Low stock, below.
_Avoid_: reorder point, reorder threshold, par level

**Stock status**:
Whether a pantry item needs restocking, derived from its quantity and minimum quantity — exactly one of In stock, Low stock, Out of stock, or Empty. Answers "do I need to restock this?", not "how much do I have?".
_Avoid_: stock level, stock state

**Low stock**:
The stock status of a pantry item whose quantity is greater than zero but below its minimum quantity — the household restocks it and is running short. Items with no minimum quantity set are never low stock.

**Out of stock**:
The stock status of a pantry item whose quantity is zero and that has a minimum quantity set — the household restocks it and has run out. More urgent than Low stock, and never both.

**Empty**:
The stock status of a pantry item whose quantity is zero and that has no minimum quantity set — none on hand, but the household doesn't restock it on a schedule, so nothing needs doing.
_Avoid_: out of stock (reserved for items with a minimum quantity)

**In stock**:
The stock status of a pantry item that is none of the above: quantity at or above its minimum quantity, or above zero with no minimum quantity set.

**Unit**:
A display-only label attached to a pantry item's quantity (count, g, kg, ml, l, box, bag, pack — defaults to count). Purely descriptive: Hyllan does no conversion or normalization between units. Not to be confused with a unit of measure in the metrological sense.

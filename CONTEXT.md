# Hyllan

Hyllan is a multi-tenant pantry inventory app: households sign up, then track what pantry items they have and how much of each.

## Language

**Household**:
The tenant boundary — created automatically for a user at signup, and strictly single-member: no invite or join mechanism exists, and there is no path for a second user to belong to the same household. Modeled as a distinct entity (not folded into the user account) so the domain language doesn't have to change if shared households are ever introduced. Owns a set of pantry items; deleting the owning user's account cascade-deletes the household and all its pantry items immediately — there is no grace period or soft-delete. Has no name field; the product refers to it as "your pantry," not by a household name.

**Pantry item**:
Something a household tracks having some quantity of. Identified within its household by `name`, case-insensitively — a household cannot have two pantry items with the same name. Adding an item under a name that already exists in the household increments that item's quantity rather than creating a second item, but only when the add's unit matches the existing item's unit; a unit mismatch rejects the add instead of merging (see ADR 0001). A pantry item's identity stays singular even once split across Locations — see Quantity.
_Avoid_: Product, ingredient, stock entry

**Quantity**:
The decimal amount of a pantry item a household currently has, shown as a single total but tracked as the sum of that item's amounts across its Locations. Zero is valid and means the item is out of stock but still tracked; negative values are invalid. Carries no unit-conversion behavior — see Unit. Incrementing/decrementing acts on a Location's amount, not on the item's total directly.

**Location**:
A place within a household's pantry (e.g. "Pantry", "Garage fridge") that a pantry item's quantity can be broken out across. Household-managed: a household creates, renames, and deletes its own locations rather than choosing from a fixed list. Identified within its household by `name`, case-insensitively, same rule as Pantry item — a household cannot have two locations with the same name. Assigning a location to an item is optional — an item's quantity can sit in an implicit unassigned bucket with no Location at all. An item can carry at most one quantity per Location (no duplicate rows for the same item/Location pair). Deleting a Location folds any quantity it held back into the owning item's unassigned bucket rather than discarding it.
_Avoid_: place, room, area, stock entry

**Stock take**:
A household-initiated pass over a single Location's pantry items, correcting each item's quantity at that Location to an observed count — used when a use or addition never got logged. Sets quantity directly as an absolute count (not a delta), and can assign a quantity to an item not yet recorded at that Location, but never touches the item's rows at other Locations and cannot create a new pantry item.
_Avoid_: inventory count, audit, reconciliation, stock entry

**Minimum quantity**:
An optional, per-pantry-item threshold in the item's own `unit` (see Unit), set by the household to mark when they consider that item low. Unset (not zero — zero already means out of stock) disables low-stock tracking for that item entirely. Determines Low stock, below.
_Avoid_: reorder point, reorder threshold, par level

**Low stock**:
The state of a pantry item whose quantity is greater than zero but at or below its minimum quantity. Mutually exclusive with out of stock (quantity exactly zero) by construction — an item is never both; a zeroed item is out of stock only, regardless of what its minimum quantity is set to. Items with no minimum quantity set are never low stock.

**Unit**:
A display-only label attached to a pantry item's quantity (count, g, kg, ml, l, box, bag, pack — defaults to count). Purely descriptive: Hyllan does no conversion or normalization between units. Not to be confused with a unit of measure in the metrological sense.

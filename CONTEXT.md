# Hyllan

Hyllan is a multi-tenant pantry inventory app: households sign up, then track what pantry items they have and how much of each.

## Language

**Household**:
The tenant boundary — created automatically for a user at signup, and strictly single-member: no invite or join mechanism exists, and there is no path for a second user to belong to the same household. Modeled as a distinct entity (not folded into the user account) so the domain language doesn't have to change if shared households are ever introduced. Owns a set of pantry items; deleting the owning user's account cascade-deletes the household and all its pantry items immediately — there is no grace period or soft-delete. Has no name field; the product refers to it as "your pantry," not by a household name.

**Pantry item**:
Something a household tracks having some quantity of. Identified within its household by `name`, case-insensitively — a household cannot have two pantry items with the same name. Adding an item under a name that already exists in the household increments that item's quantity rather than creating a second item.
_Avoid_: Product, ingredient, stock entry

**Quantity**:
The decimal amount of a pantry item a household currently has. Zero is valid and means the item is out of stock but still tracked; negative values are invalid. Carries no unit-conversion behavior — see Unit.

**Unit**:
A display-only label attached to a pantry item's quantity (count, g, kg, ml, l, box, bag, pack — defaults to count). Purely descriptive: Hyllan does no conversion or normalization between units. Not to be confused with a unit of measure in the metrological sense.
